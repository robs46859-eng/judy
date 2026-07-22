import { Buffer } from 'node:buffer';

export const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const;

export type SupportedImageMimeType = (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];

interface ValidateBase64ImageOptions {
  maxBytes: number;
  allowedMimeTypes?: readonly SupportedImageMimeType[];
}

export interface ValidatedBase64Image {
  data: string;
  mimeType: SupportedImageMimeType;
  byteLength: number;
}

function detectedMimeType(bytes: Buffer): SupportedImageMimeType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (bytes.length >= 12 && bytes.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = bytes.subarray(8, 12).toString('ascii');
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) {
      return 'image/heic';
    }
  }
  return null;
}

/**
 * Validates the encoded bytes, signature, declared MIME type, and decoded size.
 * This prevents arbitrary base64 payloads from reaching Gemini or disk storage.
 */
export function validateBase64Image(
  data: string,
  declaredMimeType: string,
  options: ValidateBase64ImageOptions
): ValidatedBase64Image | null {
  if (data.length < 4 || data.length % 4 !== 0) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return null;

  const bytes = Buffer.from(data, 'base64');
  if (bytes.length === 0 || bytes.length > options.maxBytes) return null;

  // Buffer is permissive; a canonical round trip rejects malformed encodings.
  if (bytes.toString('base64').replace(/=+$/, '') !== data.replace(/=+$/, '')) return null;

  const mimeType = detectedMimeType(bytes);
  if (!mimeType || mimeType !== declaredMimeType) return null;
  if (options.allowedMimeTypes && !options.allowedMimeTypes.includes(mimeType)) return null;

  return { data, mimeType, byteLength: bytes.length };
}
