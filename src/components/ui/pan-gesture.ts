import { useRef } from 'react';
import type { GestureResponderEvent, ViewProps } from 'react-native';

/** Gesture deltas since the touch started (px) and current velocity (px/ms). */
export interface PanGesture {
  dx: number;
  dy: number;
  vx: number;
  vy: number;
}

export interface PanGestureConfig {
  /** Become the responder as soon as the touch starts (draggable handles, map canvas). */
  claimOnStart?: boolean;
  /** Become the responder once the touch moves (swipe-to-dismiss inside pressable content). */
  claimOnMove?: (gesture: PanGesture) => boolean;
  /** Refuse to hand the gesture over to a parent (e.g. a ScrollView) while dragging. */
  lockResponder?: boolean;
  onGrant?: (event: GestureResponderEvent) => void;
  onMove?: (gesture: PanGesture, event: GestureResponderEvent) => void;
  onRelease?: (gesture: PanGesture, event: GestureResponderEvent) => void;
  onTerminate?: () => void;
}

export type PanGestureHandlers = Pick<
  ViewProps,
  | 'onStartShouldSetResponderCapture'
  | 'onStartShouldSetResponder'
  | 'onMoveShouldSetResponder'
  | 'onResponderGrant'
  | 'onResponderMove'
  | 'onResponderRelease'
  | 'onResponderTerminate'
  | 'onResponderTerminationRequest'
>;

interface Track {
  x0: number;
  y0: number;
  lastX: number;
  lastY: number;
  lastTime: number;
  vx: number;
  vy: number;
}

function timestampOf(event: GestureResponderEvent): number {
  return event.nativeEvent.timestamp || Date.now();
}

/**
 * Minimal pan gesture on top of the responder system (works on native and web without a
 * gesture-handler root). Returns View props; the handlers always see the latest render's config,
 * while the gesture tracking survives re-renders mid-gesture.
 */
export function usePanGesture(config: PanGestureConfig): PanGestureHandlers {
  const track = useRef<Track>({ x0: 0, y0: 0, lastX: 0, lastY: 0, lastTime: 0, vx: 0, vy: 0 });

  const begin = (event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    track.current = { x0: pageX, y0: pageY, lastX: pageX, lastY: pageY, lastTime: timestampOf(event), vx: 0, vy: 0 };
  };

  const measure = (event: GestureResponderEvent, advance: boolean): PanGesture => {
    const state = track.current;
    const { pageX, pageY } = event.nativeEvent;
    if (advance) {
      const time = timestampOf(event);
      const elapsed = Math.max(1, time - state.lastTime);
      state.vx = (pageX - state.lastX) / elapsed;
      state.vy = (pageY - state.lastY) / elapsed;
      state.lastX = pageX;
      state.lastY = pageY;
      state.lastTime = time;
    }
    return { dx: pageX - state.x0, dy: pageY - state.y0, vx: state.vx, vy: state.vy };
  };

  return {
    // The capture phase runs for every ancestor, so the start point is always known.
    onStartShouldSetResponderCapture: (event) => {
      begin(event);
      return false;
    },
    onStartShouldSetResponder: () => Boolean(config.claimOnStart),
    onMoveShouldSetResponder: (event) => (config.claimOnMove ? config.claimOnMove(measure(event, false)) : false),
    onResponderGrant: (event) => config.onGrant?.(event),
    onResponderMove: (event) => config.onMove?.(measure(event, true), event),
    onResponderRelease: (event) => config.onRelease?.(measure(event, true), event),
    onResponderTerminate: () => config.onTerminate?.(),
    onResponderTerminationRequest: () => !config.lockResponder,
  };
}
