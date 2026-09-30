/** `POST /uploads/images` */
export interface UploadImagePayload {
  /** Local file URI (file://, content://, blob:, data:). */
  uri: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  fileName: string | null;
  /** Size in bytes when the picker reports it (iOS/Android): a photo over the limit is refused before the transfer. */
  fileSize?: number | null;
}

export interface UploadedImage {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
}
