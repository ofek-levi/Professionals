/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Hermes (the iOS/Android engine) has no `Intl.PluralRules`, so i18next falls back to one/other
 * and never picks the Hebrew dual (`*_two`) forms. `@/i18n` loads a polyfill first; it must restore
 * the dual forms there and leave engines that do have `Intl.PluralRules` (Node, browsers) alone.
 */
type I18nModule = typeof import('@/i18n');

const enginePluralRules = Intl.PluralRules;

/** Runs `load` in a fresh module registry, as on an engine without `Intl.PluralRules` (Hermes). */
function loadWithoutPluralRules<T>(load: () => T): T {
  Reflect.deleteProperty(Intl, 'PluralRules');
  let loaded: T | undefined;
  jest.isolateModules(() => {
    loaded = load();
  });
  if (loaded === undefined) throw new Error('module did not load');
  return loaded;
}

afterEach(() => {
  Reflect.set(Intl, 'PluralRules', enginePluralRules);
});

describe('Intl.PluralRules polyfill', () => {
  it('keeps the engine implementation where there is one (Node, browsers)', () => {
    jest.isolateModules(() => {
      require('@/i18n');
    });
    expect(Intl.PluralRules).toBe(enginePluralRules);
  });

  it('without it, i18next never uses the Hebrew dual form (the Hermes behavior)', async () => {
    const { createInstance } = loadWithoutPluralRules(() => require('i18next') as typeof import('i18next'));
    const instance = createInstance();
    await instance.init({
      lng: 'he',
      ns: ['common'],
      resources: { he: { common: { counts: { reviews_one: 'ביקורת אחת', reviews_two: 'שתי ביקורות', reviews_other: '{{count}} ביקורות' } } } },
    });
    expect(instance.t('common:counts.reviews', { count: 2 })).toBe('2 ביקורות');
  });

  it('installs the CLDR rules on an engine without Intl.PluralRules', () => {
    loadWithoutPluralRules(() => require('@/i18n') as I18nModule);
    const hebrew = new Intl.PluralRules('he');
    expect([1, 2, 3, 10, 11, 20].map((count) => hebrew.select(count))).toEqual(['one', 'two', 'other', 'other', 'other', 'other']);
    expect(new Intl.PluralRules('en').resolvedOptions().pluralCategories).toEqual(['one', 'other']);
  });

  it('lets the app pick the Hebrew dual forms', async () => {
    const { initI18n, i18n } = loadWithoutPluralRules(() => require('@/i18n') as I18nModule);
    await initI18n('he');
    expect(i18n.t('common:counts.reviews', { count: 1 })).toBe('ביקורת אחת');
    expect(i18n.t('common:counts.reviews', { count: 2 })).toBe('שתי ביקורות');
    expect(i18n.t('common:units.years', { count: 2 })).toBe('שנתיים');
    expect(i18n.t('common:counts.reviews', { count: 5 })).toBe('5 ביקורות');
  });
});
