import { useTranslation } from 'react-i18next';

import { useErrorText, useErrorToast, useToast } from '@/components/ui';
import { toApiError } from '@/services/api/errors';

interface UploadErrorToastOptions {
  /** The photos can be left out (a new request): a server-side failure says so. */
  photosOptional?: boolean;
}

/**
 * Toast for a failed `POST /uploads/images`: the photo itself was refused (400/413: not a JPEG,
 * PNG, WebP or HEIC image, or over 8 MB), the upload limits were reached (429, with when to try
 * again when the server says), the photo service failed or is not set up (5xx: nothing is wrong
 * with the photo, and optional photos can be removed), or any other error as usual.
 */
export function useUploadErrorToast({ photosOptional = false }: UploadErrorToastOptions = {}): (error: unknown) => void {
  const { t } = useTranslation('errors');
  const toast = useToast();
  const errorText = useErrorText();
  const showError = useErrorToast();
  return (error) => {
    const apiError = toApiError(error);
    if (apiError.code === 'VALIDATION_ERROR') {
      toast.show({ title: t('upload.invalid.title'), message: t('upload.invalid.description'), tone: 'danger', icon: 'image-off-outline' });
    } else if (apiError.code === 'RATE_LIMITED') {
      const message = apiError.retryAfterSeconds !== null ? errorText(apiError).description : t('upload.rateLimited.description');
      toast.show({ title: t('upload.rateLimited.title'), message, tone: 'warning' });
    } else if (apiError.code === 'SERVER_ERROR') {
      const message = photosOptional ? t('upload.unavailable.optionalDescription') : t('upload.unavailable.description');
      toast.show({ title: t('upload.unavailable.title'), message, tone: 'danger', icon: 'image-off-outline' });
    } else {
      showError(apiError);
    }
  };
}
