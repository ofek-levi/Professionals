import { createElement } from 'react';
import { Platform } from 'react-native';

import { isolateText } from '@/utils/bidi';

import { resolveTextDir } from '../app-text';

describe('resolveTextDir', () => {
  it('leaves native text alone (the platform applies the Unicode rules)', () => {
    expect(resolveTextDir('Hello', true)).toBeUndefined();
  });

  describe('on web', () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, 'OS', 'web');
    });
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('uses the first strong character outside isolates', () => {
      expect(resolveTextDir(`${isolateText('Noa L.')} אישרה את ההצעה שלך.`, true)).toBe('rtl');
      expect(resolveTextDir('Great job, thanks!', true)).toBe('ltr');
      expect(resolveTextDir(['הצעה חדשה', ': ', 480], false)).toBe('rtl');
    });

    it('falls back to the layout direction for neutral text', () => {
      expect(resolveTextDir('14:30', true)).toBe('rtl');
      expect(resolveTextDir(42, false)).toBe('ltr');
    });

    it('keeps the default for rich children', () => {
      expect(resolveTextDir(['Hi ', createElement('b', { key: 'b' }, 'there')], true)).toBeUndefined();
    });
  });
});
