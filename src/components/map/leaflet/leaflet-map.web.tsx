/**
 * Web host: the same Leaflet page document in a sandboxed `<iframe srcDoc>`.
 *
 * - `sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"` (no `allow-same-origin`):
 *   the page runs on an opaque origin and cannot touch the app, its storage or cookies.
 * - Host → page: `contentWindow.postMessage(json, '*')` (an opaque origin cannot be targeted; the
 *   channel id guards the message). Page → host: accepted only from this iframe's window and with
 *   this mount's channel.
 * - Attribution links open in a new tab (the page adds `target="_blank" rel="noopener"`).
 */
import { useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from 'react';
import { View } from 'react-native';

import { makeStyles } from '@/theme';

import { buildMapDocument } from './map-document';
import { MapStatusOverlay } from './map-status-overlay';
import type { LeafletMapProps } from './types';
import { useMapBridge } from './use-map-bridge';

const SANDBOX = 'allow-scripts allow-popups allow-popups-to-escape-sandbox';

const FRAME_STYLE: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
  border: 0,
  backgroundColor: 'transparent',
};

export function LeafletMap({ state, initialRegion, style, testID, ref, ...events }: LeafletMapProps) {
  const styles = useStyles();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const bridge = useMapBridge({
    state,
    initialRegion,
    events,
    deliver: (json) => frameRef.current?.contentWindow?.postMessage(json, '*'),
  });
  const [html] = useState(() => buildMapDocument({ channel: bridge.channel }));
  useImperativeHandle(ref, () => bridge.handle, [bridge.handle]);

  const { receive } = bridge;
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const frame = frameRef.current;
      if (!frame || event.source !== frame.contentWindow) return;
      receive(event.data);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [receive]);

  return (
    <View style={[styles.container, style]} testID={testID}>
      <iframe
        key={bridge.loadKey}
        ref={frameRef}
        srcDoc={html}
        sandbox={SANDBOX}
        title={state.accessibilityLabel}
        // A static preview lets touches and clicks through to the page around it.
        style={state.interactive ? FRAME_STYLE : { ...FRAME_STYLE, pointerEvents: 'none' }}
        data-testid={testID ? `${testID}-frame` : 'map-frame'}
      />
      <MapStatusOverlay status={bridge.status} onRetry={bridge.reload} />
    </View>
  );
}

const useStyles = makeStyles(() => ({
  container: {
    overflow: 'hidden',
  },
}));
