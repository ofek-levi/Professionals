/**
 * Remembers (for the app session) the newest offer the customer has already looked at per
 * request, so request cards can highlight offers that arrived since the last visit.
 */
import { useSyncExternalStore } from 'react';

import type { CustomerRequestView, ISODateTimeString } from '@/types/domain';

export type SeenOffersMap = ReadonlyMap<string, ISODateTimeString>;

type Listener = () => void;

let snapshot: SeenOffersMap = new Map();
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => snapshot;

/** Current map (outside React). */
export function getSeenOffers(): SeenOffersMap {
  return snapshot;
}

/** Marks the offers of a request as seen up to `latestOfferAt` (never moves backwards). */
export function markOffersSeen(requestId: string, latestOfferAt: ISODateTimeString | null): void {
  if (!latestOfferAt) return;
  const previous = snapshot.get(requestId);
  if (previous && Date.parse(previous) >= Date.parse(latestOfferAt)) return;
  const next = new Map(snapshot);
  next.set(requestId, latestOfferAt);
  snapshot = next;
  listeners.forEach((listener) => listener());
}

/** Test helper / sign-out reset. */
export function resetSeenOffers(): void {
  snapshot = new Map();
  listeners.forEach((listener) => listener());
}

/** Subscribes to the seen-offers map. */
export function useSeenOffers(): SeenOffersMap {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** A request has new offers when a pending offer arrived after the last time the customer looked. */
export function hasUnseenOffers(
  request: Pick<CustomerRequestView, 'id' | 'pendingOfferCount' | 'latestOfferAt'>,
  seen: SeenOffersMap,
): boolean {
  if (request.pendingOfferCount <= 0 || !request.latestOfferAt) return false;
  const seenAt = seen.get(request.id);
  return !seenAt || Date.parse(request.latestOfferAt) > Date.parse(seenAt);
}
