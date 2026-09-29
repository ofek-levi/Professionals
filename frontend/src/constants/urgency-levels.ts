/**
 * Centralized urgency model.
 *
 * Urgency describes how quickly the problem must be handled. It is intentionally separate from the
 * customer's preferred appointment date (see `PreferredSchedule`).
 * Labels are localized via `common:urgency.<level>.label`.
 */
import type { StatusTone } from './tones';

export const URGENCY_LEVELS = ['emergency', 'urgent', 'normal', 'flexible'] as const;
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

interface UrgencyLevelMeta {
  tone: StatusTone;
  /** Lower = more urgent. Used for sorting. */
  priority: number;
  /** Pending offers on requests with this urgency expire after this many hours. */
  offerValidityHours: number;
}

export const URGENCY_META: Record<UrgencyLevel, UrgencyLevelMeta> = {
  emergency: {
    tone: 'danger',
    priority: 0,
    offerValidityHours: 6,
  },
  urgent: {
    tone: 'warning',
    priority: 1,
    offerValidityHours: 24,
  },
  normal: {
    tone: 'info',
    priority: 2,
    offerValidityHours: 72,
  },
  flexible: {
    tone: 'neutral',
    priority: 3,
    offerValidityHours: 7 * 24,
  },
};

export function compareUrgency(a: UrgencyLevel, b: UrgencyLevel): number {
  return URGENCY_META[a].priority - URGENCY_META[b].priority;
}

/**
 * Emergency and urgent requests: the only levels worth flagging in lists (a "Normal" or
 * "Flexible" pill on every card says nothing).
 */
export function isTimeCriticalUrgency(level: UrgencyLevel): boolean {
  return URGENCY_META[level].priority <= URGENCY_META.urgent.priority;
}
