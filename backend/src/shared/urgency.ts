/** Urgency levels (copied from the app's `frontend/src/constants/urgency-levels.ts`). */
export const URGENCY_LEVELS = ['emergency', 'urgent', 'normal', 'flexible'] as const;
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

interface UrgencyLevelMeta {
  /** Lower = more urgent (explorer "most urgent" sort). */
  priority: number;
  /** Pending offers on requests with this urgency expire after this many hours. */
  offerValidityHours: number;
}

export const URGENCY_META: Record<UrgencyLevel, UrgencyLevelMeta> = {
  emergency: { priority: 0, offerValidityHours: 6 },
  urgent: { priority: 1, offerValidityHours: 24 },
  normal: { priority: 2, offerValidityHours: 72 },
  flexible: { priority: 3, offerValidityHours: 7 * 24 },
};
