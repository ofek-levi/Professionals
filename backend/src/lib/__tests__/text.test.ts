import { describe, expect, it } from 'vitest';

import { messagePreview, normalizeMessageText } from '../text.js';

describe('normalizeMessageText', () => {
  it('normalizes line endings, trailing spaces, blank lines and outer whitespace', () => {
    expect(normalizeMessageText('  hi \t\r\nthere  \r\n\r\n\r\n\n end\t ')).toBe('hi\nthere\n\n end');
    expect(normalizeMessageText('a  b')).toBe('a  b');
  });

  it('runs in linear time on long runs of inner spaces (no regex backtracking)', () => {
    const hostile = `a${' '.repeat(200_000)}a`;
    const started = performance.now();
    expect(normalizeMessageText(hostile)).toBe(hostile);
    expect(messagePreview(hostile)).toBe('a a');
    expect(performance.now() - started).toBeLessThan(250);
  });
});
