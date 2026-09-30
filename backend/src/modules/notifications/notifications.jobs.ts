/**
 * Push receipts cron (every 15 min): asks Expo for the receipts of tickets sent at least 15
 * minutes ago, removes push tokens reported as `DeviceNotRegistered` (app uninstalled) from their
 * session and logs the other delivery errors. Works through the backlog in batches; unanswered tickets stay for
 * the next run until they are a day old.
 */
import type { AppDeps } from '../../deps.js';
import type { CronJob } from '../../infra/cron/index.js';
import { DEVICE_NOT_REGISTERED, type PushReceipt } from '../../infra/push/index.js';
import { forgetPushTokens } from '../auth/push-token.service.js';
import { duePushTickets, purgeExpiredPushTickets, removePushTickets, type PendingTicket } from './push-tickets.js';

const RECEIPT_DELAY_MS = 15 * 60_000;
const BATCH_SIZE = 1000;
/** Bounds one run (the lock is held for 5 minutes). */
const MAX_BATCHES = 50;

type ReceiptDeps = Pick<AppDeps, 'push' | 'redis' | 'keys' | 'clock' | 'logger'>;

function errorOf(receipt: PushReceipt | undefined): string | null {
  return receipt?.status === 'error' ? (receipt.error ?? 'Unknown') : null;
}

/** Handles one batch; returns the tickets that got a receipt and the tokens to remove. */
async function checkBatch(deps: ReceiptDeps, due: PendingTicket[], errors: Map<string, number>) {
  const receipts = await deps.push.getReceipts(due.map((ticket) => ticket.ticketId));
  const answered = due.filter((ticket) => receipts.has(ticket.ticketId));
  const unregistered: string[] = [];
  for (const ticket of answered) {
    const error = errorOf(receipts.get(ticket.ticketId));
    if (error === DEVICE_NOT_REGISTERED) unregistered.push(ticket.token);
    else if (error) errors.set(error, (errors.get(error) ?? 0) + 1);
  }
  return { answered, unregistered };
}

/** Returns how many push tokens were removed. */
export async function checkPushReceipts(deps: ReceiptDeps): Promise<number> {
  const now = deps.clock.now();
  const sentBefore = new Date(now.getTime() - RECEIPT_DELAY_MS);
  await purgeExpiredPushTickets(deps.redis, deps.keys, now);
  const errors = new Map<string, number>();
  let removed = 0;
  // Unanswered tickets stay in the set, so the next page starts after them.
  let offset = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const due = await duePushTickets(deps.redis, deps.keys, sentBefore, { offset, limit: BATCH_SIZE });
    if (due.length === 0) break;
    const { answered, unregistered } = await checkBatch(deps, due, errors);
    removed += await forgetPushTokens(unregistered);
    await removePushTickets(deps.redis, deps.keys, answered);
    offset += due.length - answered.length;
    if (due.length < BATCH_SIZE) break;
  }
  if (removed > 0) deps.logger.info({ removedCount: removed }, 'removed unregistered push tokens');
  if (errors.size > 0) deps.logger.warn({ errors: Object.fromEntries(errors) }, 'push delivery errors reported by Expo');
  return removed;
}

export function notificationJobs(deps: ReceiptDeps): CronJob[] {
  return [
    {
      name: 'push-receipts',
      schedule: '*/15 * * * *',
      lockTtlMs: 5 * 60_000,
      run: async () => {
        await checkPushReceipts(deps);
      },
    },
  ];
}
