import { horizontalScrollOffset, itemStartOffset } from '../scroll';

const base = { contentWidth: 800, viewportWidth: 390, padding: 20 };

describe('itemStartOffset', () => {
  it('adds the start padding, the widths of the items before and the gaps', () => {
    expect(itemStartOffset([80, 100, 120], 0, 8, 20)).toBe(20);
    expect(itemStartOffset([80, 100, 120], 2, 8, 20)).toBe(20 + 80 + 8 + 100 + 8);
  });
});

describe('horizontalScrollOffset', () => {
  it('scrolls so the item starts `padding` after the start edge', () => {
    expect(horizontalScrollOffset({ ...base, startOffset: 300, rtlWeb: false })).toBe(280);
    expect(horizontalScrollOffset({ ...base, startOffset: 10, rtlWeb: false })).toBe(0);
    // Never past the end of the content.
    expect(horizontalScrollOffset({ ...base, startOffset: 700, rtlWeb: false })).toBe(410);
  });

  it('uses negative offsets on RTL web pages', () => {
    expect(horizontalScrollOffset({ ...base, startOffset: 300, rtlWeb: true })).toBe(-280);
    expect(horizontalScrollOffset({ ...base, startOffset: 20, rtlWeb: true })).toBe(0);
    expect(horizontalScrollOffset({ ...base, startOffset: 700, rtlWeb: true })).toBe(-410);
  });
});
