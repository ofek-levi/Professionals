/** `POST /uploads/images` */
export interface UploadImagePayload {
  /** Local file URI (file://, content://, blob:, data:). */
  uri: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  fileName: string | null;
}

export interface UploadedImage {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
}
