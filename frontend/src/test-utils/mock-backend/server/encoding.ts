/**
 * Dependency-free UTF-8, hex and base64url helpers (identical on Hermes, the web and Jest, and
 * safe for non-Latin text such as Hebrew names).
 */

/** UTF-8 bytes of a string (lone surrogates become U+FFFD). */
export function utf8Encode(value: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i += 1) {
    let code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i += 1;
      } else {
        code = 0xfffd;
      }
    } else if (code >= 0xd800 && code <= 0xdfff) {
      code = 0xfffd;
    }
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return Uint8Array.from(bytes);
}

/** Decodes UTF-8 bytes; returns `null` for malformed input. */
export function utf8Decode(bytes: Uint8Array): string | null {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const first = bytes[i];
    let code: number;
    let extra: number;
    if (first < 0x80) {
      code = first;
      extra = 0;
    } else if (first >= 0xc2 && first < 0xe0) {
      code = first & 0x1f;
      extra = 1;
    } else if (first >= 0xe0 && first < 0xf0) {
      code = first & 0x0f;
      extra = 2;
    } else if (first >= 0xf0 && first < 0xf5) {
      code = first & 0x07;
      extra = 3;
    } else {
      return null;
    }
    for (let k = 1; k <= extra; k += 1) {
      const next = bytes[i + k];
      if (next === undefined || (next & 0xc0) !== 0x80) return null;
      code = (code << 6) | (next & 0x3f);
    }
    if (code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return null;
    out += String.fromCodePoint(code);
    i += extra + 1;
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Unpadded base64url (RFC 4648 §5) of bytes. */
export function base64UrlEncode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;
    out += BASE64URL_ALPHABET[(triple >> 18) & 0x3f] + BASE64URL_ALPHABET[(triple >> 12) & 0x3f];
    if (i + 1 < bytes.length) out += BASE64URL_ALPHABET[(triple >> 6) & 0x3f];
    if (i + 2 < bytes.length) out += BASE64URL_ALPHABET[triple & 0x3f];
  }
  return out;
}

/** Decodes base64url (or standard base64, padded or not); returns `null` for invalid input. */
export function base64UrlDecode(value: string): Uint8Array | null {
  const cleaned = value.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  if (cleaned.length % 4 === 1) return null;
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of cleaned) {
    const index = BASE64URL_ALPHABET.indexOf(char);
    if (index === -1) return null;
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

/** base64url of a string's UTF-8 bytes. */
export function base64UrlEncodeText(value: string): string {
  return base64UrlEncode(utf8Encode(value));
}

/** Text of a base64url value (UTF-8), or `null` when it is not valid base64url/UTF-8. */
export function base64UrlDecodeText(value: string): string | null {
  const bytes = base64UrlDecode(value);
  return bytes ? utf8Decode(bytes) : null;
}
