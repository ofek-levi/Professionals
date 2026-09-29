/**
 * Host side of the map bridge, shared by the native and web hosts (they only differ in how a
 * message reaches the page, how page messages arrive, and who loads the tiles).
 *
 * - Nothing is delivered before the page says `ready`; camera commands issued earlier are queued.
 * - On every `ready` of a new page load (first load, or after the page reloaded) the host sends the
 *   latest full state (so the first camera fit knows the overlay insets), then the camera (the last
 *   reported one, else the initial region), then the queued commands. The page repeats `ready`
 *   until it hears from the host; repeats of a load already served are ignored.
 * - State is delivered only when its serialized form changed, so re-renders are free.
 * - Page messages are validated (`parsePageMessage`) before any callback runs; links open only when
 *   they are one of the map's credits.
 * - A page that dies (killed web content / render process) is reloaded automatically, but not in a
 *   loop: after a few crashes in a row it ends in the error state, whose retry starts over.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { TileCoordinates } from '@/constants/map-tiles';
import type { MapRegion } from '@/utils/geo';

import { boundsToRegion, regionToBounds, type LatLngBoundsLiteral } from './map-geometry';
import {
  createChannelId,
  LEAFLET_CREDIT_URL,
  parsePageMessage,
  serializeHostMessage,
  type HostMessage,
  type MapPageState,
} from './map-protocol';
import type { LeafletMapEvents, LeafletMapHandle, MapStatus } from './types';

/** A page that has not answered by then is treated as failed (it normally takes well under 1 s). */
export const MAP_READY_TIMEOUT_MS = 15_000;
const MAX_QUEUED_COMMANDS = 20;
/** Automatic reloads after a crash allowed within `AUTO_RELOAD_WINDOW_MS` before giving up. */
export const MAX_AUTO_RELOADS = 2;
const AUTO_RELOAD_WINDOW_MS = 30_000;

/** Loads tiles for a page that cannot load them itself (web, see `web-tile-loader.ts`). */
export interface TileLoader {
  /** Starts loading a tile of `template`; calls `done` once with a data URL (or `null`). Returns a cancel function. */
  load: (template: string, tile: TileCoordinates, done: (url: string | null) => void) => () => void;
}

interface MapBridgeOptions {
  state: MapPageState;
  initialRegion: MapRegion;
  events: LeafletMapEvents;
  /** Hands a serialized host message to the page (only called once the page is ready). */
  deliver: (json: string) => void;
  /** Native: opens a tapped credit link outside the map (the page never navigates). */
  openLink?: (href: string) => void;
  /** Web: loads the tiles the page asks for. */
  tileLoader?: TileLoader;
}

export interface MapBridge {
  /** Per-mount channel id (embedded in the page document). */
  channel: string;
  status: MapStatus;
  /** Remount key of the WebView / iframe; changes on every reload. */
  loadKey: number;
  /** Feeds a raw page message (a JSON string) into the bridge. */
  receive: (raw: unknown) => void;
  /** The user's retry: remounts the page and replays camera + state on `ready`. */
  retry: () => void;
  /** The page's process died: remounts it, unless that keeps happening (then `error`). */
  recover: () => void;
  /** The native view failed to load the document. */
  fail: () => void;
  handle: LeafletMapHandle;
}

export function useMapBridge({ state, initialRegion, events, deliver, openLink, tileLoader }: MapBridgeOptions): MapBridge {
  const [channel] = useState(createChannelId);
  const [status, setStatus] = useState<MapStatus>('loading');
  const [loadKey, setLoadKey] = useState(0);
  const ready = useRef(false);
  const boot = useRef<string | null>(null);
  const queue = useRef<HostMessage[]>([]);
  const deliveredState = useRef<string | null>(null);
  const camera = useRef<LatLngBoundsLiteral | null>(null);
  const tileLoads = useRef(new Map<string, () => void>());
  const autoReloads = useRef<number[]>([]);
  const latest = useRef({ state, initialRegion, events, deliver, openLink, tileLoader });
  useEffect(() => {
    latest.current = { state, initialRegion, events, deliver, openLink, tileLoader };
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

  const cancelTiles = useCallback(() => {
    const loads = [...tileLoads.current.values()];
    tileLoads.current.clear();
    loads.forEach((cancel) => cancel());
  }, []);
  useEffect(() => cancelTiles, [cancelTiles]);

  useEffect(() => {
    if (ready.current) syncState();
  }, [state, syncState]);

  const loadTile = useCallback(
    (id: string, tile: TileCoordinates) => {
      const loader = latest.current.tileLoader;
      const loads = tileLoads.current;
      loads.get(id)?.();
      loads.delete(id);
      if (!loader) {
        send({ type: 'tile', id, url: null });
        return;
      }
      let active = true;
      const cancel = loader.load(latest.current.state.tiles.urlTemplate, tile, (url) => {
        if (!active) return;
        active = false;
        loads.delete(id);
        if (ready.current) send({ type: 'tile', id, url });
      });
      if (active) {
        loads.set(id, () => {
          active = false;
          cancel();
        });
      }
    },
    [send],
  );

  const receive = useCallback(
    (raw: unknown) => {
      const message = parsePageMessage(raw, channel);
      if (!message) return;
      const { events: handlers } = latest.current;
      switch (message.type) {
        case 'ready': {
          // The page repeats 'ready' until it hears from us: a load already served needs nothing.
          if (ready.current && message.boot === boot.current) break;
          boot.current = message.boot;
          cancelTiles();
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
        case 'openLink': {
          // Only the credits the page shows: the tile provider's licence page and Leaflet's site.
          const credits = [latest.current.state.tiles.attribution.href, LEAFLET_CREDIT_URL];
          if (credits.includes(message.href)) latest.current.openLink?.(message.href);
          break;
        }
        case 'tileRequest':
          if (ready.current) loadTile(message.id, message);
          break;
        case 'tileCancel':
          tileLoads.current.get(message.id)?.();
          tileLoads.current.delete(message.id);
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
    [channel, send, syncState, cancelTiles, loadTile],
  );

  const reload = useCallback(() => {
    ready.current = false;
    boot.current = null;
    deliveredState.current = null;
    cancelTiles();
    setStatus('loading');
    setLoadKey((key) => key + 1);
  }, [cancelTiles]);

  const fail = useCallback(() => {
    ready.current = false;
    cancelTiles();
    setStatus('error');
  }, [cancelTiles]);

  const retry = useCallback(() => {
    autoReloads.current = [];
    reload();
  }, [reload]);

  const recover = useCallback(() => {
    const now = Date.now();
    const recent = autoReloads.current.filter((time) => now - time < AUTO_RELOAD_WINDOW_MS);
    if (recent.length >= MAX_AUTO_RELOADS) {
      // It keeps dying (memory pressure, a renderer crash on this page): stop and offer the retry.
      autoReloads.current = recent;
      fail();
      return;
    }
    autoReloads.current = [...recent, now];
    reload();
  }, [reload, fail]);

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

  return { channel, status, loadKey, receive, retry, recover, fail, handle };
}
