import { bayesianRating, computeRatingBreakdown, isRating, ratingDistributionShares, roundRating } from '../rating';

describe('rating helpers', () => {
  it('rounds to one decimal', () => {
    expect(roundRating(4.66666)).toBe(4.7);
    expect(roundRating(4.04)).toBe(4);
  });

  it('computes the breakdown', () => {
    const breakdown = computeRatingBreakdown([{ rating: 5 }, { rating: 5 }, { rating: 4 }, { rating: 2 }]);
    expect(breakdown).toEqual({ averageRating: 4, reviewCount: 4, distribution: { 1: 0, 2: 1, 3: 0, 4: 1, 5: 2 } });
    expect(ratingDistributionShares(breakdown)[5]).toBe(0.5);
    expect(computeRatingBreakdown([])).toEqual({
      averageRating: null,
      reviewCount: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });
  });

  it('pulls small samples towards the prior', () => {
    expect(bayesianRating(5, 1)).toBeLessThan(bayesianRating(4.9, 80));
    expect(bayesianRating(null, 0)).toBeCloseTo(4.2, 5);
  });

  it('recognizes valid ratings', () => {
    expect(isRating(3)).toBe(true);
    expect(isRating(0)).toBe(false);
    expect(isRating(4.5)).toBe(false);
  });
});
