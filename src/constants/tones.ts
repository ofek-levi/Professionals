/** Semantic color tones used by badges, markers and status indicators (see theme tokens). */
export const STATUS_TONES = ['neutral', 'info', 'success', 'warning', 'danger', 'accent', 'brand'] as const;
export type StatusTone = (typeof STATUS_TONES)[number];
