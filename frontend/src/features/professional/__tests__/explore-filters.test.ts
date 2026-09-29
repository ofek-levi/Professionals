import {
  countActiveFilters,
  DEFAULT_EXPLORE_FILTERS,
  distanceOptionsForRadius,
  filtersToParams,
  sanitizeFilters,
  toggleInList,
  type ExploreFilters,
} from '../explore-filters';

describe('explore filters', () => {
  it('has no active filters by default and maps to empty params', () => {
    expect(countActiveFilters(DEFAULT_EXPLORE_FILTERS)).toBe(0);
    expect(filtersToParams(DEFAULT_EXPLORE_FILTERS)).toEqual({});
  });

  it('counts each narrowing filter group once', () => {
    const filters: ExploreFilters = { categoryIds: ['plumbing', 'electrical'], maxDistanceKm: 10, urgencies: ['emergency', 'urgent'] };
    expect(countActiveFilters(filters)).toBe(3);
    expect(countActiveFilters({ ...DEFAULT_EXPLORE_FILTERS, urgencies: ['normal'] })).toBe(1);
  });

  it('maps every filter to the REST params with a stable order', () => {
    const params = filtersToParams({ categoryIds: ['plumbing', 'electrical'], maxDistanceKm: 10, urgencies: ['normal', 'emergency'] });
    expect(params).toEqual({ categoryIds: ['electrical', 'plumbing'], maxDistanceKm: 10, urgencies: ['emergency', 'normal'] });
  });

  it('offers only distance presets smaller than the service radius', () => {
    expect(distanceOptionsForRadius(15)).toEqual([5, 10]);
    expect(distanceOptionsForRadius(40)).toEqual([5, 10, 20]);
    expect(distanceOptionsForRadius(80)).toEqual([5, 10, 20, 40]);
    expect(distanceOptionsForRadius(null)).toEqual([5, 10, 20, 40]);
    expect(distanceOptionsForRadius(3)).toEqual([]);
  });

  it('drops categories and distances that no longer apply', () => {
    const filters: ExploreFilters = { ...DEFAULT_EXPLORE_FILTERS, categoryIds: ['plumbing', 'painting'], maxDistanceKm: 20 };
    expect(sanitizeFilters(filters, ['plumbing'], 15)).toEqual({ ...filters, categoryIds: ['plumbing'], maxDistanceKm: null });
    expect(sanitizeFilters(filters, ['plumbing', 'painting'], 40)).toBe(filters);
    expect(sanitizeFilters(filters, undefined, undefined)).toBe(filters);
  });

  it('toggles values in multi-select lists', () => {
    expect(toggleInList(['a', 'b'], 'a')).toEqual(['b']);
    expect(toggleInList(['a'], 'b')).toEqual(['a', 'b']);
  });
});
