/**
 * The map page runtime ("bridge"): creates the Leaflet map, applies host messages and reports user
 * input (see map-protocol.ts for the message shapes).
 *
 * Kept as a plain string constant – never `fn.toString()`: Hermes release builds do not keep
 * function source. It runs inside the WebView / iframe, so it is ES5 with no imports; it must not
 * contain backticks or dollar-brace sequences (it lives in a template literal) and stays ASCII
 * (Hermes stores any other string as UTF-16, doubling its size in the bundle).
 *
 * - The page is static; everything dynamic arrives as a full `state` message that is applied by
 *   diffing layers by id (markers, circles, pin), so the camera and selection never reset.
 * - User and configuration text only reaches the DOM through `textContent` / attributes; the one
 *   HTML string (the attribution) is built from escaped text.
 * - Host detection: `window.ReactNativeWebView` (native) or `parent.postMessage` (web iframe).
 */
export const MAP_PAGE_SCRIPT = String.raw`(function () {
  'use strict';

  var TAP_DELAY_MS = 250; // a double tap zooms instead of reporting a tap
  var MARKER_TAP_GUARD_MS = 400; // a tap on a marker or the pin never also counts as a map tap
  var REGION_DEBOUNCE_MS = 120;
  var MAX_MESSAGE_LENGTH = 4000000;
  var MARKER_SIZE = 44;
  var PIN_WIDTH = 44;
  var PIN_HEIGHT = 57;
  var PIN_TIP = 54;
  var REVEAL_MARGIN = 32; // a selected marker's radius plus its halo
  var REVEAL_LABEL_MARGIN = 56; // ... plus the label bubble under it
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var THEME_VARIABLES = {
    background: '--am-bg',
    grid: '--am-grid',
    surface: '--am-surface',
    text: '--am-text',
    mutedText: '--am-muted',
    border: '--am-border',
    link: '--am-link',
    pin: '--am-pin',
    onColor: '--am-on-color',
    shadow: '--am-shadow',
    overlay: '--am-overlay',
    controlBackground: '--am-control-bg'
  };
  var INTERACTION_HANDLERS = ['dragging', 'touchZoom', 'doubleClickZoom', 'scrollWheelZoom', 'keyboard'];

  var documentRoot = document.documentElement;
  var nativeBridge = window.ReactNativeWebView;
  var config = { channel: '', icons: {}, fallbackIcon: '', pinIcon: '' };
  var map = null;
  var attribution = null;
  var tileLayer = null;
  var tilesKey = '';
  var attributionHtml = '';
  var markers = Object.create(null);
  var circles = Object.create(null);
  var pin = null;
  var booted = false;
  var viewSet = false;
  var pendingView = null;
  var revealedKey = '';
  var tapTimer = 0;
  var regionTimer = 0;
  var lastMarkerPress = 0;
  var interactiveApplied = false;
  var settings = { interactive: true, reduceMotion: false, insets: { top: 0, right: 0, bottom: 0, left: 0 } };

  // --- Messaging -----------------------------------------------------------------

  function post(message) {
    message.channel = config.channel;
    var data = JSON.stringify(message);
    if (nativeBridge && typeof nativeBridge.postMessage === 'function') {
      nativeBridge.postMessage(data);
    } else if (window.parent && window.parent !== window) {
      // A sandboxed srcdoc frame has an opaque origin: the channel id guards the message instead.
      window.parent.postMessage(data, '*');
    }
  }

  function reportError(error, fatal) {
    var text = error && error.message ? error.message : String(error);
    try {
      post({ type: 'error', message: String(text).slice(0, 500), fatal: fatal === true });
    } catch (ignored) {
      // Nothing left to report to.
    }
  }

  window.onerror = function (message, source, line, column, error) {
    reportError(error || message, !booted);
  };

  // --- Helpers -------------------------------------------------------------------

  function isNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function isLatLng(latitude, longitude) {
    return isNumber(latitude) && isNumber(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
  }

  function isPair(value) {
    return Array.isArray(value) && value.length === 2 && isNumber(value[0]) && isNumber(value[1]);
  }

  function isBounds(value) {
    return Array.isArray(value) && value.length === 2 && isPair(value[0]) && isPair(value[1]);
  }

  function text(value) {
    return typeof value === 'string' ? value : '';
  }

  function escapeHtml(value) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function element(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function iconPath(name) {
    var icons = config.icons;
    if (Object.prototype.hasOwnProperty.call(icons, name)) return icons[name];
    return Object.prototype.hasOwnProperty.call(icons, config.fallbackIcon) ? icons[config.fallbackIcon] : '';
  }

  /** A 24x24 MDI glyph built with DOM APIs (path data from the baked icon table). */
  function glyph(name) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'am-glyph');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', iconPath(name));
    svg.appendChild(path);
    return { svg: svg, path: path };
  }

  function coordinateOf(latLng) {
    var wrapped = latLng.wrap();
    return { latitude: wrapped.lat, longitude: wrapped.lng };
  }

  function sameLatLng(latLng, latitude, longitude) {
    return latLng.lat === latitude && latLng.lng === longitude;
  }

  function cancelTap() {
    if (tapTimer) clearTimeout(tapTimer);
    tapTimer = 0;
  }

  // --- Camera --------------------------------------------------------------------

  /** Edge padding (px) as Leaflet options, capped to 'share' of each axis. */
  function paddingOptions(top, right, bottom, left, share) {
    var container = map.getContainer();
    var scaleX = Math.min(1, (container.clientWidth * share) / Math.max(1, left + right));
    var scaleY = Math.min(1, (container.clientHeight * share) / Math.max(1, top + bottom));
    return {
      paddingTopLeft: [left * scaleX, top * scaleY],
      paddingBottomRight: [right * scaleX, bottom * scaleY]
    };
  }

  /**
   * Fits the camera to bounds, keeping clear of the overlay insets. 'exact' bounds are a viewport
   * the page showed before (restored after a reload): they fill the whole map.
   */
  function showBounds(bounds, durationMs, exact) {
    var container = map.getContainer();
    if (container.clientWidth < 8 || container.clientHeight < 8) {
      // Not laid out yet (e.g. a collapsed parent): fit as soon as the page gets a size.
      pendingView = { bounds: bounds, exact: exact };
      return;
    }
    pendingView = null;
    var insets = settings.insets;
    // At least 40% of each axis stays for the content.
    var options = exact ? {} : paddingOptions(insets.top, insets.right, insets.bottom, insets.left, 0.6);
    if (!viewSet || settings.reduceMotion || !(durationMs > 0)) {
      options.animate = false;
      map.fitBounds(bounds, options);
      viewSet = true;
      return;
    }
    options.duration = Math.min(durationMs, 5000) / 1000;
    map.flyToBounds(bounds, options);
  }

  function zoomBy(delta) {
    if (!viewSet) return;
    if (delta > 0) map.zoomIn(delta, { animate: !settings.reduceMotion });
    else map.zoomOut(-delta, { animate: !settings.reduceMotion });
  }

  /**
   * Pans a newly selected marker (or the selected one when the insets change, e.g. a preview card
   * opened for it) just enough to sit clear of the overlays. The user can still pan it away.
   */
  function revealSelected() {
    var selected = null;
    Object.keys(markers).some(function (id) {
      if (markers[id].data.selected === true) selected = markers[id];
      return selected !== null;
    });
    if (!selected) {
      revealedKey = '';
      return;
    }
    var insets = settings.insets;
    var key = selected.id + '|' + [insets.top, insets.right, insets.bottom, insets.left].join(',');
    if (key === revealedKey || !viewSet) return;
    revealedKey = key;
    // The attribution sits on the bottom inset: keep the label clear of it too.
    var credit = attribution.getContainer();
    var creditHeight = credit.offsetHeight ? credit.offsetHeight + (parseFloat(getComputedStyle(credit).marginBottom) || 0) : 0;
    var options = paddingOptions(
      insets.top + REVEAL_MARGIN,
      insets.right + REVEAL_MARGIN,
      insets.bottom + REVEAL_LABEL_MARGIN + creditHeight,
      insets.left + REVEAL_MARGIN,
      0.9
    );
    options.animate = !settings.reduceMotion;
    options.duration = 0.25;
    map.panInside(selected.marker.getLatLng(), options);
  }

  // --- Markers -------------------------------------------------------------------

  function describe(target, role, label, pressed) {
    if (!target) return;
    target.setAttribute('role', role);
    if (label) target.setAttribute('aria-label', label);
    else target.removeAttribute('aria-label');
    if (typeof pressed === 'boolean') target.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    else target.removeAttribute('aria-pressed');
  }

  function describeMarker(entry) {
    var data = entry.data;
    var interactive = settings.interactive;
    describe(entry.marker.getElement(), interactive ? 'button' : 'img', text(data.accessibilityLabel), interactive ? data.selected === true : null);
  }

  function onMarkerClick() {
    lastMarkerPress = Date.now();
    cancelTap();
    if (settings.interactive) post({ type: 'markerPress', id: this.id });
  }

  function createMarker(data) {
    var root = element('div', 'am-marker-root');
    var dot = element('div', 'am-marker-dot');
    var icon = glyph('');
    var label = element('div', 'am-label');
    label.setAttribute('dir', 'auto');
    label.hidden = true;
    dot.appendChild(icon.svg);
    root.appendChild(dot);
    root.appendChild(label);

    var entry = { id: data.id, data: data, key: '', root: root, dot: dot, path: icon.path, label: label, marker: null };
    entry.marker = L.marker([data.latitude, data.longitude], {
      icon: L.divIcon({ html: root, className: 'am-marker', iconSize: [MARKER_SIZE, MARKER_SIZE], iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2] }),
      interactive: settings.interactive,
      keyboard: settings.interactive,
      bubblingMouseEvents: false,
      autoPanOnFocus: settings.interactive
    });
    entry.marker.on('click', onMarkerClick, entry);
    entry.marker.on('add', function () {
      describeMarker(entry);
    });
    entry.marker.addTo(map);
    return entry;
  }

  function updateMarker(entry, data) {
    entry.data = data;
    var position = entry.marker.getLatLng();
    if (!sameLatLng(position, data.latitude, data.longitude)) entry.marker.setLatLng([data.latitude, data.longitude]);

    var selected = data.selected === true;
    var key = [text(data.color), text(data.ring), text(data.icon), text(data.label), selected, text(data.accessibilityLabel)].join('\n');
    if (key === entry.key) return;
    entry.key = key;
    entry.dot.style.backgroundColor = text(data.color);
    entry.root.style.setProperty('--am-ring', text(data.ring));
    entry.path.setAttribute('d', iconPath(text(data.icon)));
    entry.root.classList.toggle('am-selected', selected);
    var label = selected ? text(data.label) : '';
    entry.label.textContent = label;
    entry.label.hidden = !label;
    entry.marker.setZIndexOffset(selected ? 1000 : 0);
    describeMarker(entry);
  }

  function applyMarkers(list) {
    var seen = Object.create(null);
    for (var index = 0; index < list.length; index += 1) {
      var data = list[index];
      if (!data || typeof data.id !== 'string' || seen[data.id] || !isLatLng(data.latitude, data.longitude)) continue;
      seen[data.id] = true;
      var entry = markers[data.id] || (markers[data.id] = createMarker(data));
      updateMarker(entry, data);
    }
    Object.keys(markers).forEach(function (id) {
      if (seen[id]) return;
      markers[id].marker.remove();
      delete markers[id];
    });
  }

  // --- Circles -------------------------------------------------------------------

  function applyCircles(list) {
    var seen = Object.create(null);
    list.forEach(function (data) {
      if (!data || typeof data.id !== 'string' || seen[data.id] || !isLatLng(data.latitude, data.longitude)) return;
      if (!isNumber(data.radiusMeters) || data.radiusMeters <= 0) return;
      seen[data.id] = true;
      var color = text(data.color);
      var circle = circles[data.id];
      if (!circle) {
        circles[data.id] = L.circle([data.latitude, data.longitude], {
          radius: data.radiusMeters,
          interactive: false,
          color: color,
          weight: 2,
          opacity: 1,
          fillColor: color,
          fillOpacity: 0.12
        }).addTo(map);
        return;
      }
      if (!sameLatLng(circle.getLatLng(), data.latitude, data.longitude)) circle.setLatLng([data.latitude, data.longitude]);
      if (circle.getRadius() !== data.radiusMeters) circle.setRadius(data.radiusMeters);
      if (circle.options.color !== color) circle.setStyle({ color: color, fillColor: color });
    });
    Object.keys(circles).forEach(function (id) {
      if (seen[id]) return;
      circles[id].remove();
      delete circles[id];
    });
  }

  // --- Draggable pin -------------------------------------------------------------

  function createPin(data) {
    var root = element('div', 'am-pin-root');
    var head = element('div', 'am-pin-head');
    head.appendChild(glyph(config.pinIcon).svg);
    root.appendChild(head);
    root.appendChild(element('div', 'am-pin-stem'));
    root.appendChild(element('div', 'am-pin-shadow'));

    var entry = { root: root, label: '', dragging: false, marker: null };
    var marker = L.marker([data.latitude, data.longitude], {
      icon: L.divIcon({ html: root, className: 'am-pin', iconSize: [PIN_WIDTH, PIN_HEIGHT], iconAnchor: [PIN_WIDTH / 2, PIN_TIP] }),
      draggable: settings.interactive,
      interactive: settings.interactive,
      keyboard: false,
      bubblingMouseEvents: false,
      zIndexOffset: 2000,
      autoPan: true
    });
    entry.marker = marker;
    marker.on('add', function () {
      describe(marker.getElement(), 'img', entry.label, null);
    });
    marker.on('click', function () {
      lastMarkerPress = Date.now();
      cancelTap();
    });
    marker.on('dragstart', function () {
      entry.dragging = true;
      cancelTap();
      root.classList.add('am-lifted');
    });
    marker.on('dragend', function () {
      entry.dragging = false;
      lastMarkerPress = Date.now();
      root.classList.remove('am-lifted');
      post({ type: 'pinDragEnd', coordinate: coordinateOf(marker.getLatLng()) });
    });
    marker.addTo(map);
    return entry;
  }

  function applyPin(data) {
    if (!data || !isLatLng(data.latitude, data.longitude)) {
      if (pin) pin.marker.remove();
      pin = null;
      return;
    }
    if (!pin) pin = createPin(data);
    // The host echoes the dropped position back; never yank the pin while a finger holds it.
    else if (!pin.dragging && !sameLatLng(pin.marker.getLatLng(), data.latitude, data.longitude)) {
      pin.marker.setLatLng([data.latitude, data.longitude]);
    }
    pin.label = text(data.accessibilityLabel);
    describe(pin.marker.getElement(), 'img', pin.label, null);
  }

  // --- Settings ------------------------------------------------------------------

  function applyTheme(theme) {
    if (!theme || typeof theme !== 'object') return;
    Object.keys(THEME_VARIABLES).forEach(function (key) {
      if (typeof theme[key] === 'string') documentRoot.style.setProperty(THEME_VARIABLES[key], theme[key]);
    });
    documentRoot.classList.toggle('am-dark', theme.dark === true);
  }

  function applyInsets(insets) {
    function clean(value) {
      return isNumber(value) && value > 0 ? Math.min(value, 2000) : 0;
    }
    var next = insets && typeof insets === 'object' ? insets : {};
    settings.insets = { top: clean(next.top), right: clean(next.right), bottom: clean(next.bottom), left: clean(next.left) };
    var corners = map.getContainer().querySelectorAll('.leaflet-control-container > div');
    for (var index = 0; index < corners.length; index += 1) {
      var corner = corners[index];
      ['top', 'right', 'bottom', 'left'].forEach(function (edge) {
        if (corner.classList.contains('leaflet-' + edge)) corner.style[edge] = settings.insets[edge] + 'px';
      });
    }
  }

  function applyTiles(tiles) {
    if (!tiles || typeof tiles.urlTemplate !== 'string' || !/^https:\/\//.test(tiles.urlTemplate)) return;
    var maxZoom = isNumber(tiles.maxZoom) ? Math.max(2, Math.min(22, Math.round(tiles.maxZoom))) : 19;
    var key = tiles.urlTemplate + '\n' + maxZoom;
    if (key !== tilesKey) {
      tilesKey = key;
      if (tileLayer) tileLayer.remove();
      map.setMaxZoom(maxZoom);
      tileLayer = L.tileLayer(tiles.urlTemplate, { maxZoom: maxZoom, maxNativeZoom: maxZoom, className: 'am-tiles' }).addTo(map);
    }
    var credit = tiles.attribution && typeof tiles.attribution === 'object' ? tiles.attribution : {};
    var html = escapeHtml(text(credit.text));
    if (html && typeof credit.href === 'string' && /^https:\/\/[^\s"'<>]+$/.test(credit.href)) {
      html = '<a href="' + escapeHtml(credit.href) + '">' + html + '</a>';
    }
    if (html === attributionHtml) return;
    if (attributionHtml) attribution.removeAttribution(attributionHtml);
    attributionHtml = html;
    if (html) attribution.addAttribution(html);
  }

  function applyInteractive(interactive) {
    if (interactiveApplied && interactive === settings.interactive) return;
    var rebuild = interactiveApplied;
    interactiveApplied = true;
    settings.interactive = interactive;
    INTERACTION_HANDLERS.forEach(function (name) {
      var handler = map[name];
      if (!handler) return;
      if (interactive) handler.enable();
      else handler.disable();
    });
    map.getContainer().tabIndex = interactive ? 0 : -1;
    documentRoot.classList.toggle('am-static', !interactive);
    if (!rebuild) return;
    // Leaflet reads marker interactivity when a marker is added: recreate them.
    Object.keys(markers).forEach(function (id) {
      markers[id].marker.remove();
      delete markers[id];
    });
    if (pin) pin.marker.remove();
    pin = null;
  }

  function applyState(state) {
    if (!state || typeof state !== 'object') return;
    applyTheme(state.theme);
    var label = text(state.accessibilityLabel);
    if (label) map.getContainer().setAttribute('aria-label', label);
    if (/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(text(state.lang))) documentRoot.setAttribute('lang', state.lang);
    settings.reduceMotion = state.reduceMotion === true;
    documentRoot.classList.toggle('am-reduce-motion', settings.reduceMotion);
    applyInsets(state.insets);
    var position = state.rtl === true ? 'bottomleft' : 'bottomright';
    if (attribution.getPosition() !== position) attribution.setPosition(position);
    applyTiles(state.tiles);
    applyInteractive(state.interactive !== false);
    applyCircles(Array.isArray(state.circles) ? state.circles : []);
    applyMarkers(Array.isArray(state.markers) ? state.markers : []);
    applyPin(state.pin);
    revealSelected();
  }

  // --- Host -> page ---------------------------------------------------------------

  function receive(message) {
    if (!map || !message || typeof message !== 'object' || message.channel !== config.channel) return;
    try {
      switch (message.type) {
        case 'state':
          applyState(message.state);
          break;
        case 'setView':
          if (isBounds(message.bounds)) showBounds(message.bounds, 0, message.exact === true);
          break;
        case 'animateToRegion':
          if (isBounds(message.bounds)) showBounds(message.bounds, message.durationMs, false);
          break;
        case 'zoomIn':
          zoomBy(1);
          break;
        case 'zoomOut':
          zoomBy(-1);
          break;
        default:
          break;
      }
    } catch (error) {
      reportError(error, false);
    }
  }

  // Native hosts call this through injectJavaScript; the web host posts JSON strings.
  window.__appMap = { receive: receive };
  window.addEventListener('message', function (event) {
    if (nativeBridge || event.source !== window.parent || typeof event.data !== 'string' || event.data.length > MAX_MESSAGE_LENGTH) return;
    var message;
    try {
      message = JSON.parse(event.data);
    } catch (ignored) {
      return;
    }
    receive(message);
  });

  // --- Boot ----------------------------------------------------------------------

  function onMapClick(event) {
    if (!settings.interactive || Date.now() - lastMarkerPress < MARKER_TAP_GUARD_MS) return;
    var coordinate = coordinateOf(event.latlng);
    cancelTap();
    tapTimer = setTimeout(function () {
      tapTimer = 0;
      post({ type: 'mapPress', coordinate: coordinate });
    }, TAP_DELAY_MS);
  }

  function onMoveEnd() {
    if (regionTimer) clearTimeout(regionTimer);
    regionTimer = setTimeout(function () {
      regionTimer = 0;
      var bounds = map.getBounds();
      post({ type: 'regionChange', bounds: [[bounds.getSouth(), bounds.getWest()], [bounds.getNorth(), bounds.getEast()]] });
    }, REGION_DEBOUNCE_MS);
  }

  /** Links (attribution) never navigate this page: native hosts open them outside; the web opens a tab. */
  function onLinkClick(event) {
    var link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!link) return;
    if (!/^https?:\/\//i.test(link.getAttribute('href') || '')) {
      event.preventDefault();
      return;
    }
    if (!nativeBridge) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    }
  }

  function boot() {
    config = JSON.parse(document.getElementById('app-map-config').textContent);
    if (!window.L) throw new Error('Leaflet did not load');

    map = L.map('map', {
      zoomControl: false,
      attributionControl: false,
      zoomSnap: 0.25,
      minZoom: 2,
      maxZoom: 19,
      boxZoom: false
    });
    map.getContainer().setAttribute('role', 'region');

    var gridPane = map.createPane('amGrid');
    gridPane.style.zIndex = '150';
    var Grid = L.GridLayer.extend({
      createTile: function () {
        return element('div', 'am-grid-tile');
      }
    });
    new Grid({ pane: 'amGrid', updateWhenZooming: false }).addTo(map);

    attribution = L.control.attribution({ position: 'bottomright' }).addTo(map);
    map.on('click', onMapClick);
    map.on('dblclick', cancelTap);
    map.on('moveend', onMoveEnd);
    document.addEventListener('click', onLinkClick, true);
    window.addEventListener('resize', function () {
      if (pendingView) showBounds(pendingView.bounds, 0, pendingView.exact);
    });

    booted = true;
    post({ type: 'ready' });
  }

  try {
    boot();
  } catch (error) {
    reportError(error, true);
  }
})();
`;
