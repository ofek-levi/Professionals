import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { CATEGORY_IDS } from '../../shared/catalog/index.js';
import { vm } from '../../shared/validation-messages.js';
import { ApiError } from '../errors.js';
import { queryBoolean, queryEnumList, queryNumber } from '../query-schemas.js';
import { parseInput } from '../validate.js';

function failure(run: () => unknown): ApiError {
  try {
    run();
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected a validation error');
}

const schema = z.object({
  categoryId: z.enum(CATEGORY_IDS, { error: vm('category.unsupported') }),
  description: z.string().min(15, vm('request.descriptionTooShort')),
  location: z.object({ addressLine: z.string().min(1, vm('location.addressRequired')), city: z.string() }),
  keepPhotos: z.array(z.string().length(24)).max(6),
});

describe('parseInput', () => {
  it('returns the parsed value', () => {
    const value = { categoryId: 'plumbing', description: 'x'.repeat(20), location: { addressLine: 'A 1', city: 'TLV' }, keepPhotos: [] };
    expect(parseInput(schema, value)).toEqual(value);
  });

  it('keys field errors by dotted path with i18n message keys', () => {
    const error = failure(() =>
      parseInput(schema, { categoryId: 'plumbing', description: 'short', location: { addressLine: '' }, keepPhotos: ['a'] }),
    );
    expect(error.status).toBe(400);
    expect(error.toBody()).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'The request payload is invalid',
      fieldErrors: {
        description: ['validation:request.descriptionTooShort'],
        'location.addressLine': ['validation:location.addressRequired'],
        'location.city': ['validation:required'],
        'keepPhotos.0': ['validation:invalid'],
      },
    });
  });

  it('reports an unknown category as 422 UNSUPPORTED_CATEGORY', () => {
    const error = failure(() => parseInput(schema, { categoryId: 'astrology', description: 'x'.repeat(20), location: { addressLine: 'a', city: 'b' }, keepPhotos: [] }));
    expect(error.code).toBe('UNSUPPORTED_CATEGORY');
    expect(error.status).toBe(422);
    expect(error.fieldErrors).toEqual({ categoryId: ['validation:category.unsupported'] });
  });

  it('uses `root` for errors without a path', () => {
    const error = failure(() => parseInput(z.object({ a: z.string() }), 'nope'));
    expect(error.fieldErrors).toEqual({ root: ['validation:invalid'] });
  });
});

describe('query schemas', () => {
  const query = z.object({
    statuses: queryEnumList(['open', 'draft'] as const),
    unreadOnly: queryBoolean(),
    maxDistanceKm: queryNumber({ min: 0.1, max: 80 }),
  });

  it('parses comma-separated lists, booleans and numbers', () => {
    expect(parseInput(query, { statuses: 'open,draft', unreadOnly: 'true', maxDistanceKm: '12.5' })).toEqual({
      statuses: ['open', 'draft'],
      unreadOnly: true,
      maxDistanceKm: 12.5,
    });
    expect(parseInput(query, { statuses: ['open', 'draft'], unreadOnly: '0' })).toEqual({ statuses: ['open', 'draft'], unreadOnly: false });
    expect(parseInput(query, { statuses: '', maxDistanceKm: '' })).toEqual({});
  });

  it('rejects unknown values', () => {
    const error = failure(() => parseInput(query, { statuses: 'open,closed', unreadOnly: 'yes', maxDistanceKm: 'far' }));
    expect(error.fieldErrors).toEqual({
      'statuses.1': ['validation:invalid'],
      unreadOnly: ['validation:invalid'],
      maxDistanceKm: ['validation:invalid'],
    });
  });
});
