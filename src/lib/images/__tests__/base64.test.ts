import { describe, expect, it } from 'vitest';
import { validateBase64Image } from '../base64';

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);

describe('validateBase64Image', () => {
  it('accepts a canonical image whose signature matches its MIME type', () => {
    const data = PNG_HEADER.toString('base64');
    expect(validateBase64Image(data, 'image/png', { maxBytes: 100 })).toEqual({
      data,
      mimeType: 'image/png',
      byteLength: PNG_HEADER.length,
    });
  });

  it('rejects MIME spoofing, malformed base64, and oversized payloads', () => {
    expect(validateBase64Image(JPEG_HEADER.toString('base64'), 'image/png', { maxBytes: 100 })).toBeNull();
    expect(validateBase64Image('not/base64===', 'image/png', { maxBytes: 100 })).toBeNull();
    expect(validateBase64Image(PNG_HEADER.toString('base64'), 'image/png', { maxBytes: 4 })).toBeNull();
  });

  it('enforces a route-specific MIME allowlist', () => {
    expect(
      validateBase64Image(JPEG_HEADER.toString('base64'), 'image/jpeg', {
        maxBytes: 100,
        allowedMimeTypes: ['image/png'],
      })
    ).toBeNull();
  });
});
