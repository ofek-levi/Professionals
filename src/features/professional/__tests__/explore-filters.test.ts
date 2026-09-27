import {
  areFiltersEqual,
  countActiveFilters,
  DEFAULT_EXPLORE_FILTERS,
  distanceOptionsForRadius,
  filtersToParams,
  hasActiveFilters,
  preferredDateRange,
  sanitizeFilters,
  toggleInList,
  type ExploreFilters,
} from '../explore-filters';

// 2026-09-27 is a Sunday; 2026-10-01 a Thursday; 2026-10-03 a Saturday.
const sunday = new Date(2026, 8, 27, 10, 30);
const thursday = new Date(2026, 9, 1, 18, 0);
const saturday = new Date(2026, 9, 3, 9, 0);

describe('explore filters', () => {
  it('has no active filters by default and maps to empty params', () => {
    expect(countActiveFilters(DEFAULT_EXPLORE_FILTERS)).toBe(0);
    expect(hasActiveFilters(DEFAULT_EXPLORE_FILTERS)).toBe(false);
    expect(filtersToParams(DEFAULT_EXPLORE_FILTERS, sunday)).toEqual({});
    expect(filtersToParams(DEFAULT_EXPLORE_FILTERS, sunday, 'nearest')).toEqual({ sort: 'nearest' });
  });

  it('counts each narrowing filter group once', () => {
    const filters: ExploreFilters = {
      categoryIds: ['plumbing', 'electrical'],
      maxDistanceKm: 10,
      urgencies: ['emergency', 'urgent'],
      dateWindow: 'today',
      offerPresence: 'no_offers',
      hideWithMyOffer: true,
    };
    expect(countActiveFilters(filters)).toBe(6);
    expect(countActiveFilters({ ...DEFAULT_EXPLORE_FILTERS, urgencies: ['normal'] })).toBe(1);
  });

  it('maps every filter to the REST params with a stable order', () => {
    const params = filtersToParams(
      {
        categoryIds: ['plumbing', 'electrical'],
        maxDistanceKm: 10,
        urgencies: ['normal', 'emergency'],
        dateWindow: 'next3days',
        offerPresence: 'has_offers',
        hideWithMyOffer: true,
      },
      sunday,
      'most_urgent',
    );
    expect(params).toEqual({
      categoryIds: ['electrical', 'plumbing'],
      maxDistanceKm: 10,
      urgencies: ['emergency', 'normal'],
      preferredDateFrom: '2026-09-27',
      preferredDateTo: '2026-09-29',
      offerPresence: 'has_offers',
      excludeWithMyOffer: true,
      sort: 'most_urgent',
    });
  });

  it('computes preferred-date windows from local dates', () => {
    expect(preferredDateRange('any', sunday)).toBeNull();
    expect(preferredDateRange('today', sunday)).toEqual({ from: '2026-09-27', to: '2026-09-27' });
    expect(preferredDateRange('next3days', thursday)).toEqual({ from: '2026-10-01', to: '2026-10-03' });
    // The week ends on Saturday.
    expect(preferredDateRange('thisWeek', sunday)).toEqual({ from: '2026-09-27', to: '2026-10-03' });
    expect(preferredDateRange('thisWeek', thursday)).toEqual({ from: '2026-10-01', to: '2026-10-03' });
    expect(preferredDateRange('thisWeek', saturday)).toEqual({ from: '2026-10-03', to: '2026-10-03' });
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

  it('toggles values and compares filter sets regardless of order', () => {
    expect(toggleInList(['a', 'b'], 'a')).toEqual(['b']);
    expect(toggleInList(['a'], 'b')).toEqual(['a', 'b']);
    const a: ExploreFilters = { ...DEFAULT_EXPLORE_FILTERS, urgencies: ['urgent', 'emergency'] };
    const b: ExploreFilters = { ...DEFAULT_EXPLORE_FILTERS, urgencies: ['emergency', 'urgent'] };
    expect(areFiltersEqual(a, b)).toBe(true);
    expect(areFiltersEqual(a, { ...b, hideWithMyOffer: true })).toBe(false);
    expect(areFiltersEqual(a, DEFAULT_EXPLORE_FILTERS)).toBe(false);
  });
});
