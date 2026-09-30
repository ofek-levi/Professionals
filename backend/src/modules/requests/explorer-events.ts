/**
 * Explorer refreshes. A request entering or leaving the explorer (published, accepted, cancelled)
 * sends `request.updated` to every matching professional, and each connected explorer refetches
 * its first page (a `$geoNear` over its radius). A burst of publications in one area would cost
 * each professional one refetch per request, so for these explorer-only recipients the event is
 * merged per professional: the first one of a window goes out at once; the others in the window
 * become one event sent when it closes (the latest request id: the app refetches the explorer list
 * whatever the id). Owners and professionals with an offer are not merged (their open screens show
 * that request). Windows are shared by every instance through Redis; the closing send runs in the
 * background of the instance that merged the first event, so a graceful shutdown waits for it
 * (one window at most). A Redis failure sends at once.
 */
import type { AppDeps } from '../../deps.js';
import { KEY_SPACES } from '../../infra/keys.js';

type ExplorerDeps = Pick<AppDeps, 'env' | 'realtime' | 'redis' | 'keys' | 'background' | 'logger'>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function windowKey(deps: ExplorerDeps, professionalId: string): string {
  return deps.keys.key(KEY_SPACES.explorerWindow, professionalId);
}

/** `SET … NX|XX` per key in one round trip; whether each key was set. */
async function setEach(deps: ExplorerDeps, keys: string[], value: string, ttlMs: number, mode: 'NX' | 'XX'): Promise<boolean[]> {
  const pipeline = deps.redis.pipeline();
  for (const key of keys) {
    if (mode === 'NX') pipeline.set(key, value, 'PX', ttlMs, 'NX');
    else pipeline.set(key, value, 'PX', ttlMs, 'XX');
  }
  const results = (await pipeline.exec()) ?? [];
  return results.map(([error, reply]) => !error && reply === 'OK');
}

/** Sends the merged event of each professional whose window closed (latest request id wins). */
async function closeWindows(deps: ExplorerDeps, professionalIds: string[], delayMs: number): Promise<void> {
  await sleep(delayMs);
  const pipeline = deps.redis.pipeline();
  for (const id of professionalIds) pipeline.getdel(`${windowKey(deps, id)}:merged`);
  const results = (await pipeline.exec()) ?? [];
  const byRequest = new Map<string, string[]>();
  results.forEach(([error, requestId], index) => {
    const id = professionalIds[index];
    if (error || typeof requestId !== 'string' || !id) return;
    byRequest.set(requestId, [...(byRequest.get(requestId) ?? []), id]);
  });
  for (const [requestId, ids] of byRequest) await deps.realtime.publish(ids, { type: 'request.updated', requestId });
}

export async function publishToExplorers(deps: ExplorerDeps, requestId: string, professionalIds: string[]): Promise<void> {
  const windowMs = deps.env.realtime.explorerEventWindowMs;
  const event = { type: 'request.updated', requestId } as const;
  if (professionalIds.length === 0) return;
  if (windowMs <= 0) return deps.realtime.publish(professionalIds, event);
  let merged: string[] = [];
  let closers: string[] = [];
  try {
    const opened = await setEach(deps, professionalIds.map((id) => windowKey(deps, id)), requestId, windowMs, 'NX');
    const now = professionalIds.filter((_, index) => opened[index]);
    merged = professionalIds.filter((_, index) => !opened[index]);
    if (now.length > 0) await deps.realtime.publish(now, event);
    if (merged.length === 0) return;
    // The first merged event of a window schedules its closing send; later ones only update the id.
    const mergedKeys = merged.map((id) => `${windowKey(deps, id)}:merged`);
    const first = await setEach(deps, mergedKeys, requestId, 2 * windowMs, 'NX');
    closers = merged.filter((_, index) => first[index]);
    const later = mergedKeys.filter((_, index) => !first[index]);
    if (later.length > 0) await setEach(deps, later, requestId, 2 * windowMs, 'XX');
  } catch (error) {
    deps.logger.warn({ err: error }, 'explorer event windows unavailable; sending at once');
    await deps.realtime.publish(merged.length > 0 ? merged : professionalIds, event);
    return;
  }
  if (closers.length > 0) deps.background.run('explorer-window-close', () => closeWindows(deps, closers, windowMs));
}
