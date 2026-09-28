/**
 * Host side of the map bridge, shared by the native and web hosts (they only differ in how a
 * message reaches the page and how page messages arrive).
 *
 * - Nothing is delivered before the page says `ready`; camera commands issued earlier are queued.
 * - On every `ready` (first load, or after the page reloaded) the host sends the latest full state
 *   (so the first camera fit knows the overlay insets), then the camera (the last reported one,
 *   else the initial region), then the queued commands.
 * - State is delivered only when its serialized form changed, so re-renders are free.
 * - Page messages are validated (`parsePageMessage`) before any callback runs.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { MapRegion } from '@/utils/geo';

import { boundsToRegion, regionToBounds, type LatLngBoundsLiteral } from './map-geometry';
import { createChannelId, parsePageMessage, serializeHostMessage, type HostMessage, type MapPageState } from './map-protocol';
import type { LeafletMapEvents, LeafletMapHandle, MapStatus } from './types';

/** A page that has not answered by then is treated as failed (it normally takes well under 1 s). */
export const MAP_READY_TIMEOUT_MS = 15_000;
const MAX_QUEUED_COMMANDS = 20;

interface MapBridgeOptions {
  state: MapPageState;
  initialRegion: MapRegion;
  events: LeafletMapEvents;
  /** Hands a serialized host message to the page (only called once the page is ready). */
  deliver: (json: string) => void;
}

export interface MapBridge {
  /** Per-mount channel id (embedded in the page document). */
  channel: string;
  status: MapStatus;
  /** Remount key of the WebView / iframe; changes on `reload`. */
  loadKey: number;
  /** Feeds a raw page message (a JSON string) into the bridge. */
  receive: (raw: unknown) => void;
  /** Remounts the page (retry, crashed web content process) and replays camera + state on `ready`. */
  reload: () => void;
  /** The native view failed to load the document. */
  fail: () => void;
  handle: LeafletMapHandle;
}

export function useMapBridge({ state, initialRegion, events, deliver }: MapBridgeOptions): MapBridge {
  const [channel] = useState(createChannelId);
  const [status, setStatus] = useState<MapStatus>('loading');
  const [loadKey, setLoadKey] = useState(0);
  const ready = useRef(false);
  const queue = useRef<HostMessage[]>([]);
  const deliveredState = useRef<string | null>(null);
  const camera = useRef<LatLngBoundsLiteral | null>(null);
  const latest = useRef({ state, initialRegion, events, deliver });
  useEffect(() => {
    latest.current = { state, initialRegion, events, deliver };
  });

  const send = useCallback((message: HostMessage) => latest.current.deliver(serializeHostMessage(channel, message)), [channel]);

  const syncState = useCallback(() => {
    const json = serializeHostMessage(channel, { type: 'state', state: latest.current.state });
    if (json === deliveredState.current) return;
    deliveredState.current = json;
    latest.current.deliver(json);
  }, [channel]);

  const post = useCallback(
    (message: HostMessage) => {
      if (ready.current) send(message);
      else queue.current = [...queue.current, message].slice(-MAX_QUEUED_COMMANDS);
    },
    [send],
  );

  useEffect(() => {
    if (ready.current) syncState();
  }, [state, syncState]);

  const receive = useCallback(
    (raw: unknown) => {
      const message = parsePageMessage(raw, channel);
      if (!message) return;
      const { events: handlers } = latest.current;
      switch (message.type) {
        case 'ready': {
          ready.current = true;
          deliveredState.current = null;
          syncState();
          const restored = camera.current;
          send({ type: 'setView', bounds: restored ?? regionToBounds(latest.current.initialRegion), exact: restored !== null });
          const pending = queue.current;
          queue.current = [];
          pending.forEach(send);
          setStatus('ready');
          break;
        }
        case 'markerPress':
          handlers.onMarkerPress?.(message.id);
          break;
        case 'mapPress':
          handlers.onMapPress?.(message.coordinate);
          break;
        case 'pinDragEnd':
          handlers.onPinDragEnd?.(message.coordinate);
          break;
        case 'regionChange':
          camera.current = message.bounds;
          handlers.onRegionChange?.(boundsToRegion(message.bounds));
          break;
        case 'error':
          if (message.fatal) {
            ready.current = false;
            setStatus('error');
          } else if (__DEV__) {
            console.warn(`[AppMap] ${message.message}`);
          }
          break;
      }
    },
    [channel, send, syncState],
  );

  const reload = useCallback(() => {
    ready.current = false;
    deliveredState.current = null;
    setStatus('loading');
    setLoadKey((key) => key + 1);
  }, []);

  const fail = useCallback(() => {
    ready.current = false;
    setStatus('error');
  }, []);

  // A page that never answers (blocked script, broken WebView) ends in the error fallback.
  useEffect(() => {
    if (status !== 'loading') return undefined;
    const timer = setTimeout(() => setStatus((current) => (current === 'loading' ? 'error' : current)), MAP_READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [status, loadKey]);

  useEffect(() => {
    latest.current.events.onStatusChange?.(status);
  }, [status]);

  const handle = useMemo<LeafletMapHandle>(
    () => ({
      animateToRegion: (region, durationMs) => post({ type: 'animateToRegion', bounds: regionToBounds(region), durationMs }),
      zoomIn: () => post({ type: 'zoomIn' }),
      zoomOut: () => post({ type: 'zoomOut' }),
    }),
    [post],
  );

  return { channel, status, loadKey, receive, reload, fail, handle };
}
