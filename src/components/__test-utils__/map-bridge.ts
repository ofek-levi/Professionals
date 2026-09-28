/**
 * Test helpers that play the Leaflet page's side of the map bridge against the mocked WebView
 * (react-native-webview.mock.tsx). Not a test file itself.
 *
 *   const webView = screen.getByTestId('map-webview');
 *   await emitMapMessage(webView, { type: 'ready' });
 *   await emitMapMessage(webView, { type: 'mapPress', coordinate: { latitude: 32.08, longitude: 34.78 } });
 */
import { act, type screen } from '@testing-library/react-native';

import { webViewMock } from './react-native-webview.mock';

type TestElement = ReturnType<typeof screen.getByTestId>;

/** The channel id baked into a mocked map WebView's document. */
export function mapChannel(webView: TestElement): string {
  const source = webView.props.source as { html?: string } | undefined;
  const match = /"channel":"([A-Za-z0-9]+)"/.exec(source?.html ?? '');
  if (!match) throw new Error('The element has no map document');
  return match[1];
}

/** Delivers a page → host message (on the map's own channel unless `channel` is given). */
export async function emitMapMessage(webView: TestElement, message: Record<string, unknown>, channel = mapChannel(webView)) {
  const onMessage = webView.props.onMessage as (event: { nativeEvent: { data: string } }) => void;
  await act(async () => {
    onMessage({ nativeEvent: { data: JSON.stringify({ ...message, channel }) } });
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
