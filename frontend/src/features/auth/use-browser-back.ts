/**
 * Web only: lets a screen turn the browser's back button (or Android's back gesture in a mobile
 * browser) into an in-screen "back" – e.g. to the previous step of a multi-step form that keeps its
 * state in memory. The header back arrow, iOS gestures and Android's hardware back are handled by
 * the navigator (`usePreventRemove`); this covers the browser's own history, which the navigator
 * can't hold back.
 *
 * How: one `popstate` listener, installed before the router adds its own
 * (`installBrowserBackInterceptor()` at module load of the root layout – on `window`, listeners run
 * in registration order). While a screen has it enabled, the listener stops the router's listener,
 * restores the screen's history entry (same URL and state, so the router's history stays in sync)
 * and calls the screen's `onBack`. Otherwise it does nothing.
 *
 * The navigator moves through the history itself too: popping a screen (e.g. a legal document
 * closed with the header back arrow) calls `history.go(-1)`, whose `popstate` arrives after the
 * screen underneath got its focus back – and its handler. Those moves are counted (the interceptor
 * wraps `history.go`) and their `popstate` goes to the router untouched; the entry they land on is
 * the focused screen's, so an enabled handler takes it as its own.
 */
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

interface ActiveHandler {
  /** The history entry of the screen, put back after the browser moved off it. */
  entry: { state: unknown; url: string };
  onBack: () => void;
}

let active: ActiveHandler | null = null;
let installed = false;
/**
 * `history.go()` calls whose `popstate` has not arrived yet. A move the browser can't make fires
 * none, so they also expire (the router itself gives up waiting after 100 ms).
 */
const ownMoves = { count: 0, until: 0 };
const OWN_MOVE_TIMEOUT_MS = 1000;

const isWeb = () => Platform.OS === 'web' && typeof window !== 'undefined';
const currentEntry = (): ActiveHandler['entry'] => ({ state: window.history.state, url: window.location.href });

/** Installs the listener. Call once, before the navigation container mounts. No-op off the web. */
export function installBrowserBackInterceptor(): void {
  if (installed || !isWeb()) return;
  installed = true;
  const go = window.history.go.bind(window.history);
  window.history.go = (delta?: number) => {
    const now = Date.now();
    ownMoves.count = (now < ownMoves.until ? ownMoves.count : 0) + 1;
    ownMoves.until = now + OWN_MOVE_TIMEOUT_MS;
    go(delta);
  };
  window.addEventListener('popstate', (event) => {
    if (ownMoves.count > 0 && Date.now() < ownMoves.until) {
      // The navigator's own move, not the browser's back button.
      ownMoves.count -= 1;
      if (active) active.entry = currentEntry();
      return;
    }
    const handler = active;
    if (!handler) return;
    event.stopImmediatePropagation();
    window.history.pushState(handler.entry.state, '', handler.entry.url);
    handler.onBack();
  });
}

/**
 * While `enabled`, the browser's back button calls `onBack` instead of leaving the screen. Keep it
 * off while the screen navigates away itself (leaving, submitting), so the router's own history
 * moves are never intercepted.
 */
export function useBrowserBack(enabled: boolean, onBack: () => void): void {
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  });

  useEffect(() => {
    if (!enabled || !isWeb()) return;
    installBrowserBackInterceptor();
    const handler: ActiveHandler = { entry: currentEntry(), onBack: () => onBackRef.current() };
    active = handler;
    return () => {
      if (active === handler) active = null;
    };
  }, [enabled]);
}
