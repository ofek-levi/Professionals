/**
 * Jest stand-in for `react-native-webview` (its native view does not exist in Jest): a View that
 * exposes every WebView prop (`source`, `onMessage`, `onShouldStartLoadWithRequest`…) to queries,
 * with a ref whose `injectJavaScript` / `reload` calls are recorded in `webViewMock`.
 *
 * Registered for every test in jest.setup.ts; drive a map page with the helpers in map-bridge.ts.
 */
import { useImperativeHandle, type Ref } from 'react';
import { View, type ViewProps } from 'react-native';

export const webViewMock = {
  injectJavaScript: jest.fn<void, [string]>(),
  reload: jest.fn<void, []>(),
};

type MockWebViewProps = ViewProps & { ref?: Ref<typeof webViewMock> } & Record<string, unknown>;

export function WebView({ ref, ...props }: MockWebViewProps) {
  useImperativeHandle(ref, () => webViewMock);
  return <View {...props} />;
}

export default WebView;
