/**
 * Multipart bodies as the backend reads them (backend/docs/API.md → Images): a request's JSON
 * payload in the text field `data` and its photos in `photos` (`POST /requests`,
 * `PATCH /requests/:id`), the avatar in `avatar` (`PUT /me/avatar`). React Native sends the parts as
 * `{ uri, name, type }` (`getParts()`), a browser as a string and `Blob`s.
 *
 * Same order as the backend: `readMultipart` refuses what its parser refuses while reading the body
 * (not multipart, a file in another field, too many files, a file over 8 MB, `data` missing, not a
 * JSON object or with an operator key); the services then validate the payload and their rules, and
 * only then `imageFiles` checks the file types (JPEG, PNG, WebP or HEIC; the double trusts the
 * declared type, the backend reads the bytes).
 */
import { DomainError } from '@/features/shared/domain-error';
import { vm, type ValidationMessageKey } from '@/lib/validation/messages';
import { isFormData } from '@/services/api/transport';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

export interface ImageFile {
  name: string;
  type: string;
  extension: string;
}

/** A file part: declared name and type and, when known (browser), size. */
export interface UploadedFile {
  name: string | undefined;
  type: string | undefined;
  size: number | null;
}

interface Part {
  name: string;
  /** A text field's value. */
  text?: string;
  file?: UploadedFile;
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

function partsOf(form: FormData): Part[] {
  if (isNativeFormData(form)) {
    return form.getParts().map((part) =>
      part.uri ? { name: part.fieldName, file: { name: part.name, type: part.type, size: null } } : { name: part.fieldName, text: part.string ?? '' },
    );
  }
  const parts: Part[] = [];
  form.forEach((value, name) => {
    if (typeof value === 'string') parts.push({ name, text: value });
    else parts.push({ name, file: { name: 'name' in value && typeof value.name === 'string' ? value.name : undefined, type: value.type, size: value.size } });
  });
  return parts;
}

export interface MultipartOptions {
  /** The file field: `photos` or `avatar`. */
  field: string;
  maxFiles: number;
  tooManyFiles: ValidationMessageKey;
  /** Text field with the JSON payload (`data`), when the route takes one. */
  jsonField?: string;
}

function invalid(field: string, message: ValidationMessageKey, status?: number): DomainError {
  return new DomainError('VALIDATION_ERROR', `Rejected multipart field "${field}"`, { fieldErrors: { [field]: [message] }, ...(status ? { status } : {}) });
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Dotted path of the first key the backend refuses in a payload (`$…`, `__proto__`, …), or `null`. */
function findForbiddenKey(value: unknown, path: readonly string[]): string | null {
  if (value === null || typeof value !== 'object') return null;
  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || FORBIDDEN_KEYS.has(key)) return [...path, key].join('.');
    const found = findForbiddenKey((value as Record<string, unknown>)[key], [...path, key]);
    if (found) return found;
  }
  return null;
}

function jsonPayload(parts: readonly Part[], field: string): unknown {
  const raw = parts.find((part) => part.name === field)?.text;
  if (raw === undefined) throw invalid(field, vm('required'));
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw invalid(field, vm('invalid'));
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw invalid(field, vm('invalid'));
  const forbidden = findForbiddenKey(value, []);
  if (forbidden) throw invalid(forbidden, vm('invalid'));
  return value;
}

/** The JSON payload (`undefined` without `jsonField`) and the files of a multipart body (see the file comment). */
export function readMultipart(body: unknown, options: MultipartOptions): { data: unknown; files: UploadedFile[] } {
  if (!isFormData(body)) throw invalid(options.jsonField ?? options.field, options.jsonField ? vm('required') : vm('upload.invalid'));
  const parts = partsOf(body);
  const fileParts = parts.flatMap((part) => (part.file ? [{ name: part.name, file: part.file }] : []));
  const foreign = fileParts.find((part) => part.name !== options.field);
  if (foreign) throw invalid(foreign.name, vm('upload.invalid'));
  if (fileParts.length > options.maxFiles) throw invalid(options.field, options.tooManyFiles);
  if (fileParts.some((part) => part.file.size !== null && part.file.size > MAX_IMAGE_BYTES)) throw invalid(options.field, vm('upload.invalid'), 413);
  return { data: options.jsonField ? jsonPayload(parts, options.jsonField) : undefined, files: fileParts.map((part) => part.file) };
}

/** The files as images, or 400 `<field>: upload.invalid` when one is not an image (checked last, like the backend). */
export function imageFiles(files: readonly UploadedFile[], field: string): ImageFile[] {
  return files.map((file) => {
    const type = file.type?.toLowerCase() ?? '';
    const extension = EXTENSIONS[type];
    if (!extension || file.size === 0) throw invalid(field, vm('upload.invalid'));
    return { name: file.name || `photo.${extension}`, type, extension };
  });
}
