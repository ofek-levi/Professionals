/**
 * Web only: re-encodes a picked photo that is over the upload limit as a smaller JPEG in a canvas
 * (the browser's picker ignores `quality`, so it hands over the original camera file). The server
 * keeps at most 2048 px anyway. Resolves `null` where the browser cannot decode or encode it.
 */
const MAX_DIMENSION = 2048;
const JPEG_QUALITY = 0.85;
const MAX_ATTEMPTS = 4;
/** Each further attempt scales the picture down by this factor. */
const SHRINK_STEP = 0.75;

function encode(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
}

export async function shrinkImageBlob(blob: Blob, maxBytes: number): Promise<Blob | null> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null;
  const bitmap = await createImageBitmap(blob).catch(() => null);
  if (!bitmap) return null;
  try {
    let scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height, 1));
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) return null;
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const smaller = await encode(canvas);
      if (smaller && smaller.size <= maxBytes) return smaller;
      scale *= SHRINK_STEP;
    }
    return null;
  } finally {
    bitmap.close();
  }
}
