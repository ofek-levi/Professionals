/**
 * Centralized urgency model.
 *
 * Urgency describes how quickly the problem must be handled. It is intentionally separate from the
 * customer's preferred appointment date (see `PreferredSchedule`).
 * Labels/descriptions are localized via `common:urgency.<level>.label|description`.
 */
import type { StatusTone } from './tones';

export const URGENCY_LEVELS = ['emergency', 'urgent', 'normal', 'flexible'] as const;
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

export interface UrgencyLevelMeta {
  level: UrgencyLevel;
  tone: StatusTone;
  icon: string;
  /** Lower = more urgent. Used for sorting. */
  priority: number;
  /** Expected response window in hours (`null` = flexible). */
  responseWindowHours: number | null;
  /** Pending offers on requests with this urgency expire after this many hours. */
  offerValidityHours: number;
}

export const URGENCY_META: Record<UrgencyLevel, UrgencyLevelMeta> = {
  emergency: {
    level: 'emergency',
    tone: 'danger',
    icon: 'alarm-light',
    priority: 0,
    responseWindowHours: 2,
    offerValidityHours: 6,
  },
  urgent: {
    level: 'urgent',
    tone: 'warning',
    icon: 'clock-fast',
    priority: 1,
    responseWindowHours: 24,
    offerValidityHours: 24,
  },
  normal: {
    level: 'normal',
    tone: 'info',
    icon: 'calendar-clock',
    priority: 2,
    responseWindowHours: 72,
    offerValidityHours: 72,
  },
  flexible: {
    level: 'flexible',
    tone: 'neutral',
    icon: 'calendar-range',
    priority: 3,
    responseWindowHours: null,
    offerValidityHours: 7 * 24,
  },
};

export function isUrgencyLevel(value: unknown): value is UrgencyLevel {
  return typeof value === 'string' && (URGENCY_LEVELS as readonly string[]).includes(value);
}

export function compareUrgency(a: UrgencyLevel, b: UrgencyLevel): number {
  return URGENCY_META[a].priority - URGENCY_META[b].priority;
}
