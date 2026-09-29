import { createElement } from 'react';
import { Platform } from 'react-native';

import { createTheme } from '@/theme';
import { isolateText } from '@/utils/bidi';

import { resolveInputTextAlign, resolveTextDir } from '../app-text';

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

describe('resolveInputTextAlign', () => {
  const ltr = createTheme('light', false);
  const rtl = createTheme('light', true);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Inputs never mirror left/right in RTL (iOS Fabric sets no layout direction on an input's text).
  it.each(['ios', 'android', 'web'] as const)('resolves the physical side on %s', (os) => {
    jest.replaceProperty(Platform, 'OS', os);
    expect(resolveInputTextAlign('start', rtl)).toBe('right');
    expect(resolveInputTextAlign('end', rtl)).toBe('left');
    expect(resolveInputTextAlign('start', ltr)).toBe('left');
    expect(resolveInputTextAlign('end', ltr)).toBe('right');
    expect(resolveInputTextAlign('center', rtl)).toBe('center');
  });
});
