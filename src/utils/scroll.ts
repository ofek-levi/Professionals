/**
 * Scroll math for horizontal lists (chip rows) that must bring an item into view.
 *
 * Offsets are distances from the list's *start* edge (left in LTR, right in RTL). Native scroll
 * views and LTR web pages take offsets counted from the left edge; browsers count RTL offsets from
 * the right edge instead: `0` shows the start of the content and the offset grows negative.
 */

/** Distance from the content's start edge to the item's start edge, from the item widths. */
export function itemStartOffset(widths: readonly number[], index: number, gap: number, paddingStart: number): number {
  let offset = paddingStart;
  for (let i = 0; i < index; i += 1) offset += (widths[i] ?? 0) + gap;
  return offset;
}

export interface ScrollIntoViewInput {
  /** Distance from the content's start edge to the item's start edge. */
  startOffset: number;
  /** Total content width and visible width of the scroll view. */
  contentWidth: number;
  viewportWidth: number;
  /** Gap kept between the viewport's start edge and the item. */
  padding: number;
  /** Web page laid out right-to-left (negative scroll offsets). */
  rtlWeb: boolean;
}

/** Offset for `scrollTo({ x })` that shows the item `padding` away from the start edge. */
export function horizontalScrollOffset({ startOffset, contentWidth, viewportWidth, padding, rtlWeb }: ScrollIntoViewInput): number {
  const maxOffset = Math.max(0, contentWidth - viewportWidth);
  const offset = Math.min(maxOffset, Math.max(0, startOffset - padding));
  return rtlWeb && offset !== 0 ? -offset : offset;
}
