/**
 * Our CSS for the map page (after Leaflet's own stylesheet). Colors are CSS variables the page
 * script fills from the theme (`PageTheme`), so the document itself never changes with the theme.
 */
export const MAP_PAGE_STYLES = String.raw`
:root {
  color-scheme: normal;
  --am-bg: transparent;
  --am-grid: transparent;
  --am-surface: transparent;
  --am-text: currentColor;
  --am-muted: currentColor;
  --am-border: transparent;
  --am-link: currentColor;
  --am-pin: currentColor;
  --am-on-color: transparent;
  --am-shadow: transparent;
  --am-overlay: transparent;
  --am-control-bg: transparent;
}
html,
body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;
}
body {
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  overscroll-behavior: none;
}
#map {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
}
.leaflet-container {
  background: var(--am-bg);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Hebrew", "Noto Sans", Arial, sans-serif;
  font-size: 12px;
  line-height: 1.4;
  outline: none;
}
.leaflet-container:focus-visible {
  outline: 2px solid var(--am-link);
  outline-offset: -2px;
}
.am-static.leaflet-container,
.am-static .leaflet-marker-icon {
  cursor: default;
}

/* Backdrop: a quiet grid that pans and zooms with the map, visible wherever tiles are missing. */
.am-grid-tile {
  box-sizing: border-box;
  background-image: linear-gradient(to right, var(--am-grid) 1px, transparent 1px),
    linear-gradient(to bottom, var(--am-grid) 1px, transparent 1px);
  background-size: 64px 64px;
}
.am-dark .leaflet-tile-pane {
  filter: invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.9);
}

/* Markers: tone-colored dot with a glyph; selected markers grow, get a halo and show their label. */
.am-marker,
.am-pin {
  background: none;
  border: 0;
}
.am-marker-root {
  position: relative;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.am-marker-dot {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 2.5px solid var(--am-surface);
  box-shadow: 0 4px 12px var(--am-shadow);
  transition: width 0.15s ease-out, height 0.15s ease-out, box-shadow 0.15s ease-out;
}
.am-glyph {
  display: block;
  width: 18px;
  height: 18px;
  fill: var(--am-on-color);
}
.am-selected .am-marker-dot {
  width: 44px;
  height: 44px;
  box-shadow: 0 0 0 6px var(--am-ring, transparent), 0 4px 12px var(--am-shadow);
}
.am-selected .am-glyph {
  width: 22px;
  height: 22px;
}
.am-marker:focus-visible {
  outline: none;
}
.am-marker:focus-visible .am-marker-dot {
  outline: 2px solid var(--am-link);
  outline-offset: 3px;
}
.am-label {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  box-sizing: border-box;
  max-width: 160px;
  margin-top: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--am-border);
  background: var(--am-surface);
  color: var(--am-text);
  box-shadow: 0 1px 2px var(--am-shadow);
  font-size: 11px;
  font-weight: 500;
  line-height: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}
.am-label[hidden] {
  display: none;
}

/* Draggable location pin (anchor: the tip of the stem). */
.am-pin-root {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 44px;
}
.am-pin-head {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 3px solid var(--am-surface);
  background: var(--am-pin);
  box-shadow: 0 12px 32px var(--am-shadow);
  transition: transform 0.15s ease-out;
}
.am-pin-head .am-glyph {
  width: 24px;
  height: 24px;
}
.am-pin-stem {
  width: 4px;
  height: 12px;
  margin-top: -2px;
  border-radius: 0 0 2px 2px;
  background: var(--am-pin);
}
.am-pin-shadow {
  width: 14px;
  height: 5px;
  margin-top: -2px;
  border-radius: 50%;
  background: var(--am-overlay);
  opacity: 0.35;
  transition: width 0.15s ease-out, opacity 0.15s ease-out;
}
.am-lifted .am-pin-head {
  transform: translateY(-6px) scale(1.06);
}
.am-lifted .am-pin-shadow {
  width: 18px;
  opacity: 0.2;
}
.am-reduce-motion .am-marker-dot,
.am-reduce-motion .am-pin-head,
.am-reduce-motion .am-pin-shadow {
  transition: none;
}

/* Attribution: always visible (required by the tile licence). */
.leaflet-control-container .leaflet-control-attribution {
  margin: 0 6px 6px;
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--am-control-bg);
  color: var(--am-muted);
  font-size: 10px;
  line-height: 14px;
}
.leaflet-control-attribution a {
  color: var(--am-link);
  text-decoration: none;
}
`;
