import { en } from '@/i18n/locales/en';
import { he } from '@/i18n/locales/he';

import { cancelRequestSchema } from '../cancel';
import { zodIssuesToFieldErrors } from '../field-errors';
import { sendMessageSchema } from '../message';
import { vm } from '../messages';
import { createReviewSchema, reviewFormSchema, toCreateReviewPayload } from '../review';

const errorsOf = (result: { success: boolean; error?: Parameters<typeof zodIssuesToFieldErrors>[0] }) =>
  result.success || !result.error ? {} : zodIssuesToFieldErrors(result.error);

function leaves(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => leaves(child, prefix ? `${prefix}.${key}` : key));
}

describe('review schemas', () => {
  it('validates the payload', () => {
    expect(createReviewSchema.parse({ rating: 5, comment: '  Great!  ' })).toEqual({ rating: 5, comment: 'Great!' });
    expect(createReviewSchema.parse({ rating: 4, comment: '' })).toEqual({ rating: 4, comment: null });
    expect(createReviewSchema.parse({ rating: 3 })).toEqual({ rating: 3, comment: null });
    expect(errorsOf(createReviewSchema.safeParse({ rating: 6, comment: null }))).toEqual({ rating: [vm('review.ratingInvalid')] });
    expect(errorsOf(createReviewSchema.safeParse({ rating: 4.5, comment: null }))).toEqual({ rating: [vm('review.ratingInvalid')] });
    expect(errorsOf(createReviewSchema.safeParse({ comment: null }))).toEqual({ rating: [vm('review.ratingRequired')] });
  });

  it('validates the form and builds the payload', () => {
    expect(errorsOf(reviewFormSchema.safeParse({ rating: 0, comment: '' }))).toEqual({ rating: [vm('review.ratingRequired')] });
    expect(errorsOf(reviewFormSchema.safeParse({ rating: 5, comment: 'x'.repeat(801) }))).toEqual({
      comment: [vm('review.commentTooLong')],
    });
    expect(toCreateReviewPayload({ rating: 5, comment: '  ' })).toEqual({ rating: 5, comment: null });
    expect(() => toCreateReviewPayload({ rating: 0, comment: '' })).toThrow();
  });
});

describe('message, cancel and upload schemas', () => {
  it('normalizes and bounds chat messages', () => {
    expect(sendMessageSchema.parse({ text: '  Hi!\n\n\n\nThere ', clientMessageId: 'c1' })).toEqual({
      text: 'Hi!\n\nThere',
      clientMessageId: 'c1',
    });
    expect(errorsOf(sendMessageSchema.safeParse({ text: '   ', clientMessageId: 'c1' }))).toEqual({ text: [vm('message.empty')] });
    expect(errorsOf(sendMessageSchema.safeParse({ text: 'x'.repeat(2001), clientMessageId: 'c1' }))).toEqual({
      text: [vm('message.tooLong')],
    });
  });

  it('validates cancellations', () => {
    expect(cancelRequestSchema.parse({ reason: 'found_elsewhere' })).toEqual({ reason: 'found_elsewhere', comment: null });
    expect(errorsOf(cancelRequestSchema.safeParse({ reason: 'bored' }))).toEqual({ reason: [vm('cancel.reasonRequired')] });
  });
});

describe('field errors', () => {
  it('groups messages by dotted path', () => {
    const errors = zodIssuesToFieldErrors({
      issues: [
        { path: ['location', 'city'], message: 'a' },
        { path: ['location', 'city'], message: 'a' },
        { path: ['photos', 2, 'uri'], message: 'b' },
        { path: [], message: 'c' },
      ],
    });
    expect(errors).toEqual({ 'location.city': ['a'], 'photos.2.uri': ['b'], root: ['c'] });
  });
});

describe('validation locale', () => {
  it('has Hebrew translations for every English message', () => {
    expect(leaves(he.validation).sort()).toEqual(leaves(en.validation).sort());
    for (const key of leaves(he.validation)) {
      const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], he.validation);
      expect(typeof value === 'string' && value.trim().length > 0).toBe(true);
    }
  });
});
