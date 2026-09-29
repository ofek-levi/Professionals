/**
 * Image type from the file's first bytes. The multipart `Content-Type` and file name are only
 * claims of the client; what is forwarded to storage must really be one of the accepted formats.
 */
export type AcceptedImageType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic' | 'image/heif';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** ISO-BMFF major brands of HEIF images (iPhone photos are `heic`). AVIF is not accepted. */
const HEIF_BRANDS: Record<string, AcceptedImageType> = {
  heic: 'image/heic',
  heix: 'image/heic',
  hevc: 'image/heic',
  hevx: 'image/heic',
  heim: 'image/heif',
  heis: 'image/heif',
  mif1: 'image/heif',
  msf1: 'image/heif',
};

function ascii(buffer: Buffer, start: number, end: number): string {
  return buffer.length >= end ? buffer.toString('latin1', start, end) : '';
}

export function detectImageType(buffer: Buffer): AcceptedImageType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= PNG_SIGNATURE.length && buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return 'image/png';
  if (ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 12) === 'WEBP') return 'image/webp';
  if (ascii(buffer, 4, 8) === 'ftyp') return HEIF_BRANDS[ascii(buffer, 8, 12)] ?? null;
  return null;
}
