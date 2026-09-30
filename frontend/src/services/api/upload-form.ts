/**
 * The multipart body of `POST /uploads/images`: the picked image in the field `file`. React Native
 * streams a `{ uri, name, type }` part from the device; a browser needs the bytes, so the picker's
 * `blob:` / `data:` URL is read into a `Blob` first. The server checks the real type from the bytes.
 *
 * Size: the API refuses files over `APP_CONFIG.maxUploadBytes` (8 MiB), but only after the whole
 * transfer. So a bigger photo is re-encoded smaller on the web (`shrink-image.ts`; the web picker
 * ignores `quality` and hands over the camera original), and refused before sending on iOS/Android
 * (their picker already recompresses) with the same error the server would answer.
 */
import { Platform } from 'react-native';

import { APP_CONFIG } from '@/constants/app-config';
import { vm } from '@/lib/validation/messages';
import type { UploadImagePayload } from '@/types/api';

import { ApiError } from './errors';
import { shrinkImageBlob } from './shrink-image';

const DEFAULT_TYPE = 'image/jpeg';

/** React Native's `FormData` file part: the file is streamed from `uri` (the DOM typings lack it). */
interface NativeFilePart {
  uri: string;
  name: string;
  type: string;
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

/** The picked file's name, or `photo.<ext>` for its type. */
export function uploadFileName(payload: Pick<UploadImagePayload, 'fileName' | 'mimeType'>): string {
  const name = payload.fileName?.trim();
  if (name) return name;
  return `photo.${EXTENSIONS[payload.mimeType ?? DEFAULT_TYPE] ?? 'jpg'}`;
}

/** What the server answers for a file over the limit (400/413 `fieldErrors.file`), without the transfer. */
function photoTooLarge(): ApiError {
  return new ApiError(413, { code: 'VALIDATION_ERROR', message: 'The photo is larger than the upload limit', fieldErrors: { file: [vm('upload.invalid')] } });
}

/** `name` with the `.jpg` extension (the photo was re-encoded as JPEG). */
function asJpegName(name: string): string {
  return `${name.replace(/\.[^./\\]+$/, '')}.jpg`;
}

export async function buildImageFormData(payload: UploadImagePayload): Promise<FormData> {
  const form = new FormData();
  const name = uploadFileName(payload);
  const type = payload.mimeType ?? DEFAULT_TYPE;
  const limit = APP_CONFIG.maxUploadBytes;
  if (Platform.OS === 'web') {
    const blob = await (await fetch(payload.uri)).blob();
    if (blob.size <= limit) {
      form.append('file', blob, name);
      return form;
    }
    const smaller = await shrinkImageBlob(blob, limit);
    if (!smaller) throw photoTooLarge();
    form.append('file', smaller, asJpegName(name));
  } else {
    if (payload.fileSize != null && payload.fileSize > limit) throw photoTooLarge();
    const part: NativeFilePart = { uri: payload.uri, name, type };
    form.append('file', part as unknown as Blob);
  }
  return form;
}
