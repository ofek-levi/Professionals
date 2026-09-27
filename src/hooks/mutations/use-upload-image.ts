import { useMutation } from '@tanstack/react-query';

import { api } from '@/services/api';
import type { UploadImagePayload } from '@/types/api';

/**
 * `POST /uploads/images` – uploads one picked photo and resolves with its id/url. Use the returned
 * ids as `photoIds` when creating a request. Upload several with `Promise.all(photos.map(mutateAsync))`.
 */
export function useUploadImage() {
  return useMutation({
    mutationFn: (payload: UploadImagePayload) => api.uploads.uploadImage(payload),
  });
}
