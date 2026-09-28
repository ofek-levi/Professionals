/**
 * Native host (iOS / Android): the Leaflet page in a react-native-webview.
 *
 * - The document is built once per mount (`source` never changes: a new source reloads the page).
 * - Host → page: `injectJavaScript` calls `window.__appMap.receive(<escaped JSON>)`; page → host:
 *   `window.ReactNativeWebView.postMessage`, validated against this mount's channel.
 * - Locked down: no file access, no DOM storage, no extra windows, https-only content, and a
 *   navigation policy (`shouldStartMapLoad`) that keeps the page in place.
 * - A killed web content process (iOS) / render process (Android) remounts the WebView; the bridge
 *   replays camera and state on the next `ready`.
 * - Gestures inside ScrollViews: Android's `nestedScrollEnabled` makes the WebView forbid its
 *   parents from intercepting touches; on iOS the map holds the enclosing ScrollView's scroll lock
 *   while touched (see ui/scroll-lock.tsx).
 */
import Constants from 'expo-constants';
import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Linking, Platform, View, type GestureResponderEvent } from 'react-native';
import { WebView } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

import { makeStyles } from '@/theme';

import { useScrollLock } from '../../ui/scroll-lock';
import { buildMapDocument } from './map-document';
import { MapStatusOverlay } from './map-status-overlay';
import type { LeafletMapProps } from './types';
import { useMapBridge } from './use-map-bridge';

/** Origin the inline document runs on (https, so tiles are never mixed content). */
export const MAP_BASE_URL = 'https://localhost/';
/** Only the initial document load needs the whitelist; other URLs go through `shouldStartMapLoad`. */
const ORIGIN_WHITELIST = ['https://localhost'];
/** Appended to the WebView's user agent: tile servers ask apps to identify themselves (OSM tile policy). */
const USER_AGENT_APP = `${Constants.expoConfig?.slug ?? 'professionals'}/${Constants.expoConfig?.version ?? '1.0.0'}`;
/** iOS may cancel RN's touch once WebKit takes it over: keep the scroll lock a moment longer. */
const UNLOCK_AFTER_CANCEL_MS = 300;

/** Script that hands one serialized message (escaped JSON, see `toSafeJson`) to the page. */
export function receiveScript(json: string): string {
  return `window.__appMap && window.__appMap.receive(${json});true;`;
}

/**
 * Navigation policy of the map WebView. Allowed: the page itself (iOS asks for the initial
 * `baseUrl` / about:blank main-frame load – refusing it leaves the map blank) and sub-frame loads.
 * A tapped http(s) link (the attribution) opens in the browser instead. Everything else is refused.
 */
export function shouldStartMapLoad({ url, isTopFrame }: Pick<ShouldStartLoadRequest, 'url' | 'isTopFrame'>): boolean {
  if (url === MAP_BASE_URL || url === 'about:blank') return true;
  if (isTopFrame === false) return true;
  if (/^https?:\/\//i.test(url)) {
    Linking.openURL(url).catch(() => undefined);
    return false;
  }
  return false;
}

export function LeafletMap({ state, initialRegion, style, testID, ref, ...events }: LeafletMapProps) {
  const styles = useStyles();
  const webViewRef = useRef<WebView>(null);
  const bridge = useMapBridge({
    state,
    initialRegion,
    events,
    deliver: (json) => webViewRef.current?.injectJavaScript(receiveScript(json)),
  });
  const [source] = useState(() => ({ html: buildMapDocument({ channel: bridge.channel }), baseUrl: MAP_BASE_URL }));
  useImperativeHandle(ref, () => bridge.handle, [bridge.handle]);

  // iOS: hold the enclosing ScrollView still while a finger is on the map.
  const scrollLock = useScrollLock();
  const [lockOwner] = useState(() => ({}));
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setScrollLocked = (locked: boolean) => {
    if (unlockTimer.current) clearTimeout(unlockTimer.current);
    unlockTimer.current = null;
    scrollLock?.set(lockOwner, locked);
  };
  useEffect(
    () => () => {
      if (unlockTimer.current) clearTimeout(unlockTimer.current);
      scrollLock?.set(lockOwner, false);
    },
    [scrollLock, lockOwner],
  );
  const locksScroll = Platform.OS === 'ios' && scrollLock !== null && state.interactive;
  const touchHandlers = locksScroll
    ? {
        onTouchStart: () => setScrollLocked(true),
        onTouchEnd: (event: GestureResponderEvent) => {
          if (event.nativeEvent.touches.length === 0) setScrollLocked(false);
        },
        // Releasing mid-gesture is safe: a re-enabled UIScrollView ignores touches already in flight.
        onTouchCancel: () => {
          if (unlockTimer.current) clearTimeout(unlockTimer.current);
          unlockTimer.current = setTimeout(() => setScrollLocked(false), UNLOCK_AFTER_CANCEL_MS);
        },
      }
    : null;

  return (
    <View style={[styles.container, state.interactive ? null : styles.static, style]} testID={testID} {...touchHandlers}>
      <WebView
        key={bridge.loadKey}
        ref={webViewRef}
        source={source}
        originWhitelist={ORIGIN_WHITELIST}
        applicationNameForUserAgent={USER_AGENT_APP}
        onShouldStartLoadWithRequest={shouldStartMapLoad}
        onMessage={(event) => bridge.receive(event.nativeEvent.data)}
        onError={bridge.fail}
        onContentProcessDidTerminate={bridge.reload}
        onRenderProcessGone={bridge.reload}
        javaScriptEnabled
        domStorageEnabled={false}
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        mixedContentMode="never"
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        allowsLinkPreview={false}
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
      <MapStatusOverlay status={bridge.status} onRetry={bridge.reload} />
    </View>
  );
}

const useStyles = makeStyles(() => ({
  container: {
    overflow: 'hidden',
  },
  static: {
    pointerEvents: 'none',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
}));
