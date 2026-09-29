import type { UploadedImage } from '../../shared/contract/index.js';
import type { UploadDoc } from './upload.model.js';

export function toUploadedImage(upload: Pick<UploadDoc, '_id' | 'url' | 'width' | 'height'>): UploadedImage {
  return { id: upload._id.toHexString(), url: upload.url, width: upload.width, height: upload.height };
}
