/**
 * The multipart body of `POST /uploads/images`: the picked image in the field `file`. React Native
 * streams a `{ uri, name, type }` part from the device; a browser needs the bytes, so the picker's
 * `blob:` / `data:` URL is read into a `Blob` first. The server checks the real type from the bytes.
 */
import { Platform } from 'react-native';

import type { UploadImagePayload } from '@/types/api';

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

export async function buildImageFormData(payload: UploadImagePayload): Promise<FormData> {
  const form = new FormData();
  const name = uploadFileName(payload);
  const type = payload.mimeType ?? DEFAULT_TYPE;
  if (Platform.OS === 'web') {
    const blob = await (await fetch(payload.uri)).blob();
    form.append('file', blob, name);
  } else {
    const part: NativeFilePart = { uri: payload.uri, name, type };
    form.append('file', part as unknown as Blob);
  }
  return form;
}
