import type { UploadedImage, UploadImagePayload } from '@/types/api';
import type { ApiClient } from '../client';

export function createUploadsApi(client: ApiClient) {
  return {
    /**
     * `POST /uploads/images`
     * A real backend would receive multipart data or hand out a pre-signed URL; the payload
     * shape is kept small so either approach can be implemented behind this function.
     */
    uploadImage: (payload: UploadImagePayload) => client.post<UploadedImage>('/uploads/images', payload),
  };
}
