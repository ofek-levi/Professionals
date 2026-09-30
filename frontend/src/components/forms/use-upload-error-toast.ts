import { useTranslation } from 'react-i18next';

import { useErrorText, useErrorToast, useToast } from '@/components/ui';
import { toApiError } from '@/services/api/errors';

/**
 * Toast for a failed `POST /uploads/images`: the photo itself was refused (400/413: not a JPEG,
 * PNG, WebP or HEIC image, or over 8 MB), the upload limits were reached (429, with when to try
 * again when the server says), or any other error as usual.
 */
export function useUploadErrorToast(): (error: unknown) => void {
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
    } else {
      showError(apiError);
    }
  };
}
