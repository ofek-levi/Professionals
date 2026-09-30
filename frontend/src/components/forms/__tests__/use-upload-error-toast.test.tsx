/**
 * A refused photo upload is explained in the user's language: the photo itself (400/413), the
 * upload limits (429, with Retry-After when sent), anything else like other errors.
 */
import { act, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/components/__test-utils__/render';
import { ToastProvider } from '@/components/ui';
import { i18n, initI18n } from '@/i18n';
import { ApiError } from '@/services/api/errors';

import { useUploadErrorToast } from '../use-upload-error-toast';

beforeAll(async () => {
  await initI18n('en');
});
afterAll(async () => {
  await i18n.changeLanguage('en');
});

async function showFor(error: unknown) {
  let show: ((error: unknown) => void) | null = null;
  function Probe() {
    show = useUploadErrorToast();
    return null;
  }
  await renderWithProviders(
    <ToastProvider>
      <Probe />
    </ToastProvider>,
  );
  await act(async () => {
    show?.(error);
  });
}

const apiError = (status: number, code: 'VALIDATION_ERROR' | 'RATE_LIMITED' | 'SERVER_ERROR', retryAfter: number | null = null) =>
  new ApiError(status, { code, message: 'x', ...(code === 'VALIDATION_ERROR' ? { fieldErrors: { file: ['validation:upload.invalid'] } } : {}) }, retryAfter);

describe('upload error toast', () => {
  it.each([400, 413])('explains a refused photo (%i)', async (status) => {
    await showFor(apiError(status, 'VALIDATION_ERROR'));
    expect(await screen.findByText('This photo can’t be used')).toBeOnTheScreen();
    expect(screen.getByText('Choose a JPEG, PNG, WebP or HEIC photo of up to 8 MB.')).toBeOnTheScreen();
  });

  it('says when to try again after the upload limit (429 with Retry-After)', async () => {
    await showFor(apiError(429, 'RATE_LIMITED', 120));
    expect(await screen.findByText('Too many photos for now')).toBeOnTheScreen();
    expect(screen.getByText('Please try again in 2 minutes.')).toBeOnTheScreen();
  });

  it('falls back to "later" without Retry-After', async () => {
    await showFor(apiError(429, 'RATE_LIMITED'));
    expect(await screen.findByText('You’ve uploaded a lot of photos recently. Please try again later.')).toBeOnTheScreen();
  });

  it('shows any other failure like other errors (e.g. storage not configured: 503)', async () => {
    await showFor(apiError(503, 'SERVER_ERROR'));
    expect(await screen.findByText(i18n.t('errors:codes.SERVER_ERROR.title'))).toBeOnTheScreen();
    expect(screen.queryByText('This photo can’t be used')).toBeNull();
  });

  it('speaks Hebrew with the dual form', async () => {
    await i18n.changeLanguage('he');
    await showFor(apiError(429, 'RATE_LIMITED', 2));
    expect(await screen.findByText('יותר מדי תמונות כרגע')).toBeOnTheScreen();
    expect(screen.getByText('נסו שוב בעוד שתי שניות.')).toBeOnTheScreen();
    await i18n.changeLanguage('en');
  });
});
