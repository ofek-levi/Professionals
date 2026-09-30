/**
 * Multipart bodies of the routes that take images with their owner: `POST /requests` and
 * `PATCH /requests/:id` (the JSON payload in the text field `data`, then the photos as `photos`),
 * `PUT /me/avatar` (one image as `avatar`). React Native streams a `{ uri, name, type }` part from
 * the device; a browser needs the bytes, so the picker's `blob:` / `data:` URL is read into a
 * `Blob` first. The server checks the real type from the bytes.
 *
 * Size: the API refuses files over `APP_CONFIG.maxUploadBytes` (8 MiB), but only after the whole
 * transfer. So a bigger photo is re-encoded smaller on the web (`shrink-image.ts`; the web picker
 * ignores `quality` and hands over the camera original), and refused before sending on iOS/Android
 * (their picker already recompresses) with the same error the server would answer (413).
 */
import { Platform } from 'react-native';

import { APP_CONFIG } from '@/constants/app-config';
import { vm } from '@/lib/validation/messages';
import { MULTIPART_FIELDS, type LocalImage } from '@/types/api';

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
export function imageFileName(image: Pick<LocalImage, 'fileName' | 'mimeType'>): string {
  const name = image.fileName?.trim();
  if (name) return name;
  return `photo.${EXTENSIONS[image.mimeType ?? DEFAULT_TYPE] ?? 'jpg'}`;
}

/** What the server answers for a file over the limit (413 `fieldErrors.<field>`), without the transfer. */
function imageTooLarge(field: string): ApiError {
  return new ApiError(413, { code: 'VALIDATION_ERROR', message: 'The photo is larger than the upload limit', fieldErrors: { [field]: [vm('upload.invalid')] } });
}

/** `name` with the `.jpg` extension (the photo was re-encoded as JPEG). */
function asJpegName(name: string): string {
  return `${name.replace(/\.[^./\\]+$/, '')}.jpg`;
}

async function appendImage(form: FormData, field: string, image: LocalImage): Promise<void> {
  const name = imageFileName(image);
  const limit = APP_CONFIG.maxUploadBytes;
  if (Platform.OS === 'web') {
    const blob = await (await fetch(image.uri)).blob();
    if (blob.size <= limit) {
      form.append(field, blob, name);
      return;
    }
    const smaller = await shrinkImageBlob(blob, limit);
    if (!smaller) throw imageTooLarge(field);
    form.append(field, smaller, asJpegName(name));
    return;
  }
  if (image.fileSize != null && image.fileSize > limit) throw imageTooLarge(field);
  const part: NativeFilePart = { uri: image.uri, name, type: image.mimeType ?? DEFAULT_TYPE };
  form.append(field, part as unknown as Blob);
}

interface ImageFormInput {
  /** JSON payload sent first, as the text field `data` (omit for the avatar). */
  data?: unknown;
  /** File field of the images: `photos` or `avatar`. */
  field: string;
  images: readonly LocalImage[];
}

export async function buildImageForm({ data, field, images }: ImageFormInput): Promise<FormData> {
  const form = new FormData();
  if (data !== undefined) form.append(MULTIPART_FIELDS.payload, JSON.stringify(data));
  for (const image of images) await appendImage(form, field, image);
  return form;
}

/**
 * Time limit of a request carrying `count` images (`undefined`: the client's default): time for each
 * image of up to 8 MB on a slow mobile connection. The API accepts a body for longer than the
 * largest post takes (`API_LIMITS.requestTimeoutMs` in the backend).
 */
export function imageTimeoutMs(count: number): number | undefined {
  return count > 0 ? APP_CONFIG.photoUploadTimeoutMs * count : undefined;
}
