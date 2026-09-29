import { DEFAULT_CATEGORY_CATALOG } from '@/constants/professional-categories';

import { createCategoryLookup, normalizeSearchText, searchCategoryCatalog } from '../use-category-catalog';

// The hook module imports the API singleton; the pure helpers under test don't need it.
jest.mock('@/services/api', () => ({ api: {} }));

const ids = (query: string, language: 'en' | 'he') =>
  searchCategoryCatalog(DEFAULT_CATEGORY_CATALOG.categories, query, language).map((category) => category.id);

describe('category catalog search', () => {
  it('normalizes Hebrew final letters, niqqud and punctuation', () => {
    expect(normalizeSearchText('  מַזְגָן ')).toBe('מזגנ');
    expect(normalizeSearchText('ג׳וקים')).toBe('ג וקימ');
    expect(normalizeSearchText('Wi-Fi')).toBe('wi fi');
  });

  it('ranks name matches first', () => {
    expect(ids('plumb', 'en')[0]).toBe('plumbing');
    expect(ids('Electr', 'en')[0]).toBe('electrical');
  });

  it('matches keywords in both languages regardless of the UI language', () => {
    expect(ids('leak', 'en')).toContain('plumbing');
    expect(ids('ikea', 'he')).toContain('furniture_assembly');
    expect(ids('מזגן', 'en')[0]).toBe('hvac');
    expect(ids('חשמלאי', 'he')[0]).toBe('electrical');
  });

  it('requires every word to match and returns nothing for gibberish', () => {
    expect(ids('kitchen countertop', 'en')).toEqual(['kitchen_renovation']);
    expect(ids('zzqx', 'en')).toEqual([]);
  });

  it('returns all categories for an empty query', () => {
    expect(ids('  ', 'en')).toHaveLength(DEFAULT_CATEGORY_CATALOG.categories.length);
  });

  it('builds ordered lookups', () => {
    const lookup = createCategoryLookup(DEFAULT_CATEGORY_CATALOG);
    expect(lookup.groups.map((group) => group.id)).toEqual([
      'home_repairs',
      'construction_renovation',
      'moving_transportation',
      'other_services',
    ]);
    expect(lookup.getCategory('locksmith')?.name.en).toBe('Locksmith');
    expect(lookup.getCategory('nope')).toBeUndefined();
    expect(lookup.popularCategories.every((category) => category.isPopular)).toBe(true);
  });
});
