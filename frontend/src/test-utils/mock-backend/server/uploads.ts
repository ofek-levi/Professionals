/**
 * The multipart body of `POST /uploads/images` as the backend reads it: one image in the field
 * `file`, JPEG/PNG/WebP/HEIC of at most 8 MB; other fields are ignored. React Native sends the part
 * as `{ uri, name, type }` (streamed from the device, `getParts()`), a browser as a `Blob`. The
 * double trusts the declared type (the backend checks the bytes).
 */
import { isFormData } from '@/services/api/transport';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

export interface UploadedImageFile {
  name: string;
  type: string;
  extension: string;
}

/** A part of React Native's `FormData` (`getParts()`). */
interface NativeFormPart {
  fieldName: string;
  uri?: string;
  name?: string;
  type?: string;
  string?: string;
}

interface NativeFormData {
  getParts(): NativeFormPart[];
}

const isNativeFormData = (form: FormData): form is FormData & NativeFormData =>
  typeof (form as Partial<NativeFormData>).getParts === 'function';

function accept(name: string | undefined, type: string | undefined, size: number | null): UploadedImageFile | null {
  const mimeType = type?.toLowerCase() ?? '';
  const extension = EXTENSIONS[mimeType];
  if (!extension || (size !== null && (size === 0 || size > MAX_UPLOAD_BYTES))) return null;
  return { name: name || `photo.${extension}`, type: mimeType, extension };
}

/** The image of a valid upload body, or `null` (JSON body, no `file`, not an image, too large). */
export function readUploadedImage(body: unknown): UploadedImageFile | null {
  if (!isFormData(body)) return null;
  if (isNativeFormData(body)) {
    const part = body.getParts().find((candidate) => candidate.fieldName === 'file');
    return part?.uri ? accept(part.name, part.type, null) : null;
  }
  const value = body.get('file');
  if (value === null || typeof value === 'string') return null;
  const name = 'name' in value && typeof value.name === 'string' ? value.name : undefined;
  return accept(name, value.type, value.size);
}
