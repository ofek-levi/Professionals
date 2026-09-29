import { base64UrlDecode, base64UrlDecodeText, base64UrlEncode, base64UrlEncodeText, bytesToHex, utf8Decode, utf8Encode } from '../encoding';
import { sha256Hex } from '../sha256';

describe('sha256Hex', () => {
  it('matches the FIPS 180-4 test vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
    expect(sha256Hex('a'.repeat(1000))).toBe('41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3');
  });

  it('hashes the UTF-8 bytes of non-Latin text deterministically', () => {
    expect(sha256Hex('שלום')).toBe(sha256Hex('שלום'));
    expect(sha256Hex('שלום')).not.toBe(sha256Hex('שלוםם'));
    expect(sha256Hex('שלום')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('encoding', () => {
  it('round-trips UTF-8 including Hebrew and emoji', () => {
    for (const text of ['', 'abc', 'נועה לוי', 'Анна', '😀 ok']) {
      expect(utf8Decode(utf8Encode(text))).toBe(text);
      expect(base64UrlDecodeText(base64UrlEncodeText(text))).toBe(text);
    }
    expect(bytesToHex(utf8Encode('א'))).toBe('d790');
  });

  it('encodes unpadded base64url and rejects invalid input', () => {
    expect(base64UrlEncode(Uint8Array.from([0xfb, 0xff]))).toBe('-_8');
    expect(base64UrlEncodeText('hello')).toBe('aGVsbG8');
    expect(Array.from(base64UrlDecode('aGVsbG8=') ?? [])).toEqual(Array.from(utf8Encode('hello')));
    expect(base64UrlDecode('a')).toBeNull();
    expect(base64UrlDecode('ab$c')).toBeNull();
    expect(utf8Decode(Uint8Array.from([0xc3]))).toBeNull();
    expect(utf8Decode(Uint8Array.from([0xff]))).toBeNull();
  });
});
