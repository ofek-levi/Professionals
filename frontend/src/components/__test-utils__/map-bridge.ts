/**
 * Test helpers that play the Leaflet page's side of the map bridge against the mocked WebView
 * (react-native-webview.mock.tsx). Not a test file itself.
 *
 *   const webView = getMapWebView();
 *   await emitMapMessage(webView, { type: 'ready' }); // a newly loaded page
 *   await emitMapMessage(webView, { type: 'mapPress', coordinate: { latitude: 32.08, longitude: 34.78 } });
 */
import { act, screen } from '@testing-library/react-native';

import { webViewMock } from './react-native-webview.mock';

type TestElement = ReturnType<typeof screen.getByTestId>;

/**
 * The map's (mocked) WebView. Until the page is ready it is hidden from screen readers (the status
 * overlay covers it), so plain `getByTestId` would not find it.
 */
export function getMapWebView(testID = 'map-webview'): TestElement {
  return screen.getByTestId(testID, { includeHiddenElements: true });
}

export function findMapWebView(testID = 'map-webview', timeout?: number): Promise<TestElement> {
  return screen.findByTestId(testID, { includeHiddenElements: true }, timeout ? { timeout } : undefined);
}

/** The channel id baked into a mocked map WebView's document. */
export function mapChannel(webView: TestElement): string {
  const source = webView.props.source as { html?: string } | undefined;
  const match = /"channel":"([A-Za-z0-9]+)"/.exec(source?.html ?? '');
  if (!match) throw new Error('The element has no map document');
  return match[1];
}

let boots = 0;

/**
 * Delivers a page → host message (on the map's own channel unless `channel` is given). A `ready`
 * without a `boot` id gets a new one, i.e. comes from a newly loaded page.
 */
export async function emitMapMessage(webView: TestElement, message: Record<string, unknown>, channel = mapChannel(webView)) {
  const onMessage = webView.props.onMessage as (event: { nativeEvent: { data: string } }) => void;
  const boot = message.type === 'ready' && message.boot === undefined ? { boot: `testboot${(boots += 1)}` } : null;
  await act(async () => {
    onMessage({ nativeEvent: { data: JSON.stringify({ ...message, ...boot, channel }) } });
  });
}

/** Host → page messages injected into mocked WebViews so far (parsed, in order). */
export function injectedMapMessages(): Record<string, unknown>[] {
  return webViewMock.injectJavaScript.mock.calls.map(([script]) => {
    const match = /^window\.__appMap && window\.__appMap\.receive\((.*)\);true;$/s.exec(script);
    if (!match) throw new Error(`Unexpected injected script: ${script.slice(0, 80)}`);
    return JSON.parse(match[1]) as Record<string, unknown>;
  });
}
