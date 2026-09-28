import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { initI18n } from '@/i18n';
import type { Review } from '@/types/domain';

import { renderWithProviders } from '../../__test-utils__/render';
import { ReviewCard } from '../review-card';

const review = (comment: string): Review => ({
  id: 'rev_1',
  jobId: 'job_1',
  professionalId: 'pro_1',
  customerId: 'cus_1',
  customerDisplayName: 'Noa L.',
  customerAvatarUrl: null,
  categoryId: 'plumbing',
  rating: 5,
  comment,
  createdAt: '2026-09-20T10:00:00.000Z',
});

const commentAlign = () => StyleSheet.flatten(screen.getByTestId('review-comment').props.style).textAlign;

describe('ReviewCard comment alignment', () => {
  beforeAll(async () => {
    await initI18n('en');
  });

  // Native resolves `start` to `left` and lets the platform mirror it in RTL (see `resolveTextAlign`).
  it('keeps text in the UI language on the start side', async () => {
    await renderWithProviders(<ReviewCard review={review('עבודה מצוינת, ממליצה בחום')} />, { isRTL: true });
    expect(commentAlign()).toBe('left');
  });

  it('aligns an English comment to its own side in the Hebrew UI', async () => {
    await renderWithProviders(<ReviewCard review={review('Great job, very professional.')} />, { isRTL: true });
    expect(commentAlign()).toBe('right');
  });

  it('aligns a Hebrew comment to its own side in the English UI', async () => {
    await renderWithProviders(<ReviewCard review={review('עבודה מצוינת')} />, { isRTL: false });
    expect(commentAlign()).toBe('right');
  });
});

describe('ReviewCard meta', () => {
  beforeAll(async () => {
    await initI18n('en');
  });

  it('puts the date before the category so a long category is what gets cut', async () => {
    await renderWithProviders(<ReviewCard review={review('Great job')} showCategory />);
    expect(screen.getByText('Noa L.')).toBeOnTheScreen();
    expect(screen.getByText('Sep 20 · Plumbing')).toBeOnTheScreen();
  });

  it('leaves out the author for the compact variant', async () => {
    await renderWithProviders(<ReviewCard review={review('Great job')} hideAuthor />);
    expect(screen.queryByText('Noa L.')).not.toBeOnTheScreen();
    expect(screen.getByText('Great job')).toBeOnTheScreen();
  });
});
