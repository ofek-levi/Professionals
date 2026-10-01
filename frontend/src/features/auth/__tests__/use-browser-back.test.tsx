/**
 * The browser's back button on the web (`useBrowserBack`): it steps a screen back instead of leaving
 * it, while the navigator's own history moves – popping a screen above it, e.g. a legal document
 * closed with the header back arrow – reach the router untouched, even when their `popstate`
 * arrives after the screen got its handler back.
 */
import { renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { installBrowserBackInterceptor, useBrowserBack } from '../use-browser-back';

type Entry = { state: { id: string }; url: string };
type PopStateListener = (event: { stopImmediatePropagation: () => void }) => void;

/** A browser tab's history (`window.history`, `window.location`, `popstate`). */
function installBrowser() {
  let stack: Entry[] = [];
  let index = -1;
  const listeners: PopStateListener[] = [];
  const history = {
    get state() {
      return stack[index].state;
    },
    pushState(state: Entry['state'], _title: string, url: string) {
      stack = [...stack.slice(0, index + 1), { state, url }];
      index = stack.length - 1;
    },
    /** Moves now; the `popstate` comes with `firePopState()` (it is asynchronous in browsers). */
    go(delta = 0) {
      index += delta;
    },
  };
  const target = window as unknown as Record<string, unknown>;
  const previous = { history: target.history, location: target.location, addEventListener: target.addEventListener };
  Object.defineProperty(window, 'history', { value: history, configurable: true });
  Object.defineProperty(window, 'location', {
    get: () => ({ href: stack[index].url }),
    configurable: true,
  });
  target.addEventListener = (type: string, listener: PopStateListener) => {
    if (type === 'popstate') listeners.push(listener);
  };
  return {
    /** A fresh tab that went through `entries`. */
    reset(entries: Entry[]) {
      stack = [...entries];
      index = stack.length - 1;
    },
    get url() {
      return stack[index].url;
    },
    /** The browser's back button: one entry back, then `popstate`. */
    back() {
      index -= 1;
      this.firePopState();
    },
    firePopState() {
      let stopped = false;
      const event = { stopImmediatePropagation: () => void (stopped = true) };
      for (const listener of listeners) {
        if (stopped) break;
        listener(event);
      }
    },
    restore() {
      Object.defineProperty(window, 'history', { value: previous.history, configurable: true });
      Object.defineProperty(window, 'location', { value: previous.location, configurable: true });
      target.addEventListener = previous.addEventListener;
    },
  };
}

const SIGN_IN: Entry = { state: { id: 'sign-in' }, url: 'http://localhost/sign-in' };
const SIGN_UP: Entry = { state: { id: 'sign-up' }, url: 'http://localhost/auth/sign-up' };
const TERMS: Entry = { state: { id: 'terms' }, url: 'http://localhost/legal/terms' };

const platform = Platform as { OS: string };
const os = platform.OS;
let browser: ReturnType<typeof installBrowser>;
const routerListener = jest.fn();

beforeAll(() => {
  browser = installBrowser();
  Object.defineProperty(platform, 'OS', { value: 'web', configurable: true });
  // At module load of the root layout: before the router's own listener.
  installBrowserBackInterceptor();
  window.addEventListener('popstate', routerListener);
});

afterAll(() => {
  Object.defineProperty(platform, 'OS', { value: os, configurable: true });
  browser.restore();
});

beforeEach(() => {
  browser.reset([SIGN_IN, SIGN_UP]);
  routerListener.mockClear();
});

it('turns the browser’s back button into the screen’s back and keeps the screen’s entry', async () => {
  const onBack = jest.fn();
  await renderHook(() => useBrowserBack(true, onBack));

  browser.back();
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(routerListener).not.toHaveBeenCalled();
  expect(browser.url).toBe(SIGN_UP.url);
});

it('leaves the navigator’s own move back to the screen to the router (a document closed with the header arrow)', async () => {
  const onBack = jest.fn();
  // The sign-up step got its handler back while the document's entry was still current.
  const hook = await renderHook(({ enabled }: { enabled: boolean }) => useBrowserBack(enabled, onBack), { initialProps: { enabled: false } });
  window.history.pushState(TERMS.state, '', TERMS.url);
  await hook.rerender({ enabled: true });

  // The navigator pops the document: `history.go(-1)`, and its `popstate` afterwards.
  window.history.go(-1);
  browser.firePopState();
  expect(onBack).not.toHaveBeenCalled();
  expect(routerListener).toHaveBeenCalledTimes(1);
  expect(browser.url).toBe(SIGN_UP.url);

  // The browser's back button afterwards still steps back, and restores the sign-up's own entry.
  browser.back();
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(routerListener).toHaveBeenCalledTimes(1);
  expect(browser.url).toBe(SIGN_UP.url);
});

it('does nothing while disabled', async () => {
  const onBack = jest.fn();
  await renderHook(() => useBrowserBack(false, onBack));
  browser.back();
  expect(onBack).not.toHaveBeenCalled();
  expect(routerListener).toHaveBeenCalledTimes(1);
  expect(browser.url).toBe(SIGN_IN.url);
});
