/**
 * Native host (iOS / Android): the Leaflet page in a react-native-webview.
 *
 * - The document is built once per mount (`source` never changes: a new source reloads the page).
 * - Host → page: `injectJavaScript` calls `window.__appMap.receive(<escaped JSON>)`; page → host:
 *   `window.ReactNativeWebView.postMessage`, validated against this mount's channel.
 * - Locked down: no file access, no DOM storage, no extra windows, no data detectors, https-only
 *   content, and a navigation policy (`shouldStartMapLoad`, which sees every request) that loads
 *   nothing but the page itself. Tapped credit links reach the host as `openLink` messages.
 * - A killed web content process (iOS) / render process (Android) remounts the WebView (a few times
 *   at most); the bridge replays camera and state on the next `ready`.
 * - Gestures inside ScrollViews: Android's `nestedScrollEnabled` makes the WebView forbid its
 *   parents from intercepting touches; on iOS the map holds the enclosing ScrollView's scroll lock
 *   while touched (see ui/scroll-lock.tsx).
 */
import Constants from 'expo-constants';
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Linking, Platform, View, type GestureResponderEvent } from 'react-native';
import { WebView } from 'react-native-webview';
import type { ShouldStartLoadRequest, WebViewErrorEvent, WebViewMessageEvent } from 'react-native-webview/lib/WebViewTypes';

import { makeStyles } from '@/theme';

import { useScrollLock } from '../../ui/scroll-lock';
import { buildMapDocument } from './map-document';
import { MapStatusOverlay } from './map-status-overlay';
import type { LeafletMapProps } from './types';
import { useMapBridge } from './use-map-bridge';

/** Origin the inline document runs on (https, so tiles are never mixed content). */
export const MAP_BASE_URL = 'https://localhost/';
/**
 * Every URL passes the library's whitelist, so every navigation reaches `shouldStartMapLoad`
 * (a URL the whitelist rejects is handed to `Linking` by react-native-webview itself).
 */
export const ORIGIN_WHITELIST = ['*'];
/** Appended to the WebView's user agent: tile servers ask apps to identify themselves (OSM tile policy). */
const USER_AGENT_APP = `${Constants.expoConfig?.slug ?? 'professionals'}/${Constants.expoConfig?.version ?? '1.0.0'}`;
/** iOS may cancel RN's touch once WebKit takes it over: keep the scroll lock a moment longer. */
const UNLOCK_AFTER_CANCEL_MS = 300;

/** Script that hands one serialized message (escaped JSON, see `toSafeJson`) to the page. */
export function receiveScript(json: string): string {
  return `window.__appMap && window.__appMap.receive(${json});true;`;
}

/**
 * Navigation policy of the map WebView: only the page's own document loads (iOS asks for the
 * initial `baseUrl` / about:blank main-frame load – refusing it leaves the map blank). Everything
 * else is refused: the page opens its links through the bridge (`openLink`) and has no frames.
 */
export function shouldStartMapLoad({ url, isTopFrame }: Pick<ShouldStartLoadRequest, 'url' | 'isTopFrame'>): boolean {
  return isTopFrame !== false && (url === MAP_BASE_URL || url === 'about:blank');
}

const openExternally = (href: string) => {
  Linking.openURL(href).catch(() => undefined);
};

/** Ids of the touches an event started or ended. */
const changedTouchIds = ({ nativeEvent }: GestureResponderEvent) =>
  (nativeEvent.changedTouches?.length ? nativeEvent.changedTouches : [nativeEvent]).map((touch) => String(touch.identifier));

export function LeafletMap({ state, initialRegion, style, testID, ref, ...events }: LeafletMapProps) {
  const styles = useStyles();
  const webViewRef = useRef<WebView>(null);
  const bridge = useMapBridge({
    state,
    initialRegion,
    events,
    deliver: (json) => webViewRef.current?.injectJavaScript(receiveScript(json)),
    openLink: openExternally,
  });
  const [source] = useState(() => ({ html: buildMapDocument({ channel: bridge.channel }), baseUrl: MAP_BASE_URL }));
  useImperativeHandle(ref, () => bridge.handle, [bridge.handle]);

  const { receive, fail } = bridge;
  // Stable: Android's WebView re-subscribes its message listener whenever this prop changes.
  const onMessage = useCallback((event: WebViewMessageEvent) => receive(event.nativeEvent.data), [receive]);
  const onError = useCallback(
    (event: WebViewErrorEvent) => {
      // The map shows its own localized error: skip the library's (English) error view.
      event.preventDefault();
      fail();
    },
    [fail],
  );

  // iOS: hold the enclosing ScrollView still while a finger is on the map. The map tracks its own
  // touches: the end of a touch that began elsewhere is never delivered here.
  const scrollLock = useScrollLock();
  const [lockOwner] = useState(() => ({}));
  const ownTouches = useRef(new Set<string>());
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setScrollLocked = (locked: boolean) => {
    if (unlockTimer.current) clearTimeout(unlockTimer.current);
    unlockTimer.current = null;
    scrollLock?.set(lockOwner, locked);
  };
  useEffect(
    () => () => {
      if (unlockTimer.current) clearTimeout(unlockTimer.current);
      ownTouches.current.clear();
      scrollLock?.set(lockOwner, false);
    },
    [scrollLock, lockOwner],
  );
  /** Keeps only this map's touches that are still down; returns whether any is. */
  const updateTouches = (event: GestureResponderEvent, started: boolean) => {
    const active = new Set((event.nativeEvent.touches ?? []).map((touch) => String(touch.identifier)));
    const changed = changedTouchIds(event);
    const own = ownTouches.current;
    own.forEach((id) => {
      if (!active.has(id) || (!started && changed.includes(id))) own.delete(id);
    });
    if (started) changed.forEach((id) => own.add(id));
    return own.size > 0;
  };
  const locksScroll = Platform.OS === 'ios' && scrollLock !== null && state.interactive;
  const touchHandlers = locksScroll
    ? {
        onTouchStart: (event: GestureResponderEvent) => {
          updateTouches(event, true);
          setScrollLocked(true);
        },
        onTouchEnd: (event: GestureResponderEvent) => {
          if (!updateTouches(event, false)) setScrollLocked(false);
        },
        // Releasing mid-gesture is safe: a re-enabled UIScrollView ignores touches already in flight.
        onTouchCancel: (event: GestureResponderEvent) => {
          if (updateTouches(event, false)) return;
          if (unlockTimer.current) clearTimeout(unlockTimer.current);
          unlockTimer.current = setTimeout(() => setScrollLocked(false), UNLOCK_AFTER_CANCEL_MS);
        },
      }
    : null;

  const ready = bridge.status === 'ready';
  return (
    <View style={[styles.container, style]} testID={testID} {...touchHandlers}>
      {/* A failed page is unmounted (a WebView whose render process is gone must not be reused). */}
      {bridge.status === 'error' ? null : (
        <View
          // Static preview: touches go to the screen behind; the status overlay's retry stays pressable.
          style={[styles.page, state.interactive ? null : styles.static]}
          // Under the loading overlay the page is not for screen readers either.
          accessibilityElementsHidden={!ready}
          importantForAccessibility={ready ? 'auto' : 'no-hide-descendants'}
        >
          <WebView
            key={bridge.loadKey}
            ref={webViewRef}
            source={source}
            originWhitelist={ORIGIN_WHITELIST}
            applicationNameForUserAgent={USER_AGENT_APP}
            onShouldStartLoadWithRequest={shouldStartMapLoad}
            onMessage={onMessage}
            onError={onError}
            onContentProcessDidTerminate={bridge.recover}
            onRenderProcessGone={bridge.recover}
            javaScriptEnabled
            domStorageEnabled={false}
            allowFileAccess={false}
            allowFileAccessFromFileURLs={false}
            allowUniversalAccessFromFileURLs={false}
            mixedContentMode="never"
            setSupportMultipleWindows={false}
            javaScriptCanOpenWindowsAutomatically={false}
            allowsLinkPreview={false}
            dataDetectorTypes="none"
            textInteractionEnabled={false}
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            nestedScrollEnabled={state.interactive}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            automaticallyAdjustContentInsets={false}
            contentInsetAdjustmentBehavior="never"
            setBuiltInZoomControls={false}
            setDisplayZoomControls={false}
            textZoom={100}
            webviewDebuggingEnabled={__DEV__}
            accessibilityLabel={state.accessibilityLabel}
            style={styles.webView}
            testID={testID ? `${testID}-webview` : 'map-webview'}
          />
        </View>
      )}
      <MapStatusOverlay status={bridge.status} onRetry={bridge.retry} />
    </View>
  );
}

const useStyles = makeStyles(() => ({
  container: {
    overflow: 'hidden',
  },
  page: {
    flex: 1,
  },
  static: {
    pointerEvents: 'none',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
}));
