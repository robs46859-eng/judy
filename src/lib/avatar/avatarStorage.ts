import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import {
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface AvatarManifest<Report extends JsonValue = JsonValue> {
  sha256: string;
  filename: string;
  size: number;
  uploadedAt: string;
  report: Report;
  modelUrl: string;
}

export interface StoredAvatar<Report extends JsonValue = JsonValue> {
  manifest: AvatarManifest<Report>;
  bytes: Buffer;
}

export interface AvatarStorageOptions {
  /** Overrides AVATAR_STORAGE_DIR. Intended primarily for isolated tests. */
  rootDir?: string;
  /** Injectable clock keeps timestamp assertions deterministic. */
  now?: () => Date;
}

export interface ActivateAvatarInput<Report extends JsonValue = JsonValue> {
  bytes: Buffer | Uint8Array;
  originalFilename: string;
  report: Report;
}

export class AvatarStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AvatarStorageError';
  }
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SHA_VERSION_LENGTH = 12;

function storageRoot(options?: AvatarStorageOptions): string {
  const configured = options?.rootDir || process.env.AVATAR_STORAGE_DIR;
  return resolve(
    /* turbopackIgnore: true */ configured || join(process.cwd(), 'data', 'avatar-assets')
  );
}

function pathWithin(root: string, ...segments: string[]): string {
  const absoluteRoot = resolve(root);
  const candidate = resolve(absoluteRoot, ...segments);
  if (candidate !== absoluteRoot && !candidate.startsWith(`${absoluteRoot}${sep}`)) {
    throw new AvatarStorageError('Avatar storage path is invalid.');
  }
  return candidate;
}

function versionPath(root: string, sha256: string): string {
  if (!SHA256_PATTERN.test(sha256)) {
    throw new AvatarStorageError('Avatar manifest contains an invalid SHA-256 digest.');
  }
  return pathWithin(root, 'versions', `${sha256}.glb`);
}

function manifestPath(root: string): string {
  return pathWithin(root, 'manifest', 'current.json');
}

function modelUrl(sha256: string): string {
  return `/api/avatar/model?v=${sha256.slice(0, SHA_VERSION_LENGTH)}`;
}

/**
 * Treat the supplied name as display-only metadata. Directory components,
 * control characters, Unicode lookalikes, and non-portable punctuation are
 * removed; storage paths are always derived from the content hash instead.
 */
function sanitizeOriginalFilename(originalFilename: string): string {
  const portablePath = originalFilename.replace(/\\/g, '/');
  const base = basename(portablePath)
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, '');
  const withoutExtension = base.replace(/\.glb$/i, '');
  const safeStem = withoutExtension
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 100)
    .replace(/[._-]+$/g, '');

  return `${safeStem || 'avatar'}.glb`;
}

function cloneJsonValue(value: unknown): JsonValue {
  let encoded: string | undefined;
  try {
    encoded = JSON.stringify(value);
  } catch {
    throw new AvatarStorageError('Avatar validation report must be JSON serializable.');
  }
  if (encoded === undefined) {
    throw new AvatarStorageError('Avatar validation report must be JSON serializable.');
  }
  return JSON.parse(encoded) as JsonValue;
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  if (typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value !== 'object') return false;
  return Object.values(value as Record<string, unknown>).every(isJsonValue);
}

function parseManifest<Report extends JsonValue>(raw: string): AvatarManifest<Report> {
  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    throw new AvatarStorageError('Avatar manifest is invalid.');
  }

  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new AvatarStorageError('Avatar manifest is invalid.');
  }

  const value = candidate as Record<string, unknown>;
  const sha256 = value.sha256;
  const filename = value.filename;
  const size = value.size;
  const uploadedAt = value.uploadedAt;
  const report = value.report;
  const storedModelUrl = value.modelUrl;

  const timestampIsValid =
    typeof uploadedAt === 'string' &&
    Number.isFinite(Date.parse(uploadedAt)) &&
    new Date(uploadedAt).toISOString() === uploadedAt;

  if (
    typeof sha256 !== 'string' ||
    !SHA256_PATTERN.test(sha256) ||
    typeof filename !== 'string' ||
    filename !== sanitizeOriginalFilename(filename) ||
    typeof size !== 'number' ||
    !Number.isSafeInteger(size) ||
    size <= 0 ||
    !timestampIsValid ||
    !isJsonValue(report) ||
    storedModelUrl !== modelUrl(sha256)
  ) {
    throw new AvatarStorageError('Avatar manifest is invalid.');
  }

  return {
    sha256,
    filename,
    size,
    uploadedAt,
    report: report as Report,
    modelUrl: storedModelUrl as string,
  };
}

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return !!error && typeof error === 'object' && (error as NodeJS.ErrnoException).code === code;
}

async function writeVersionOnce(root: string, sha256: string, bytes: Buffer): Promise<void> {
  const versionsDir = pathWithin(root, 'versions');
  const destination = versionPath(root, sha256);
  await mkdir(versionsDir, { recursive: true });

  const existingVersionIsValid = async (): Promise<boolean> => {
    let existing: Buffer;
    try {
      existing = await readFile(destination);
    } catch (error) {
      if (isNodeErrorWithCode(error, 'ENOENT')) return false;
      throw error;
    }

    const existingSha256 = createHash('sha256').update(existing).digest('hex');
    if (existing.length !== bytes.length || existingSha256 !== sha256) {
      throw new AvatarStorageError('A stored avatar version is corrupted.');
    }
    return true;
  };

  if (await existingVersionIsValid()) return;

  const temporary = pathWithin(versionsDir, `.${sha256}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 });
    try {
      await rename(temporary, destination);
    } catch (error) {
      // A concurrent activation of the same content may have won the race.
      // Its bytes necessarily have the same SHA-256, so retaining it is safe.
      if (!(await existingVersionIsValid())) throw error;
    }
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}

async function writeCurrentManifestAtomically(
  root: string,
  manifest: AvatarManifest
): Promise<void> {
  const directory = pathWithin(root, 'manifest');
  await mkdir(directory, { recursive: true });

  const temporary = pathWithin(directory, `.current.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, {
      flag: 'wx',
      mode: 0o600,
    });
    await rename(temporary, manifestPath(root));
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}

/** Returns the active avatar manifest, or null before the first activation. */
export async function getCurrentAvatar<Report extends JsonValue = JsonValue>(
  options?: AvatarStorageOptions
): Promise<AvatarManifest<Report> | null> {
  const root = storageRoot(options);
  let raw: string;
  try {
    raw = await readFile(manifestPath(root), 'utf8');
  } catch (error) {
    if (isNodeErrorWithCode(error, 'ENOENT')) return null;
    throw error;
  }
  return parseManifest<Report>(raw);
}

/** Reads and verifies the bytes referenced by the active manifest. */
export async function readCurrentAvatar<Report extends JsonValue = JsonValue>(
  options?: AvatarStorageOptions
): Promise<StoredAvatar<Report> | null> {
  const root = storageRoot(options);
  const manifest = await getCurrentAvatar<Report>(options);
  if (!manifest) return null;

  let bytes: Buffer;
  try {
    bytes = await readFile(versionPath(root, manifest.sha256));
  } catch (error) {
    if (isNodeErrorWithCode(error, 'ENOENT')) {
      throw new AvatarStorageError('The active avatar asset is missing.');
    }
    throw error;
  }

  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== manifest.size || sha256 !== manifest.sha256) {
    throw new AvatarStorageError('The active avatar asset does not match its manifest.');
  }

  return { manifest, bytes };
}

/**
 * Persists immutable, content-addressed GLB bytes and atomically makes their
 * manifest current. Previous version files are intentionally never removed.
 */
export async function activateAvatar<Report extends JsonValue = JsonValue>(
  input: ActivateAvatarInput<Report>,
  options?: AvatarStorageOptions
): Promise<AvatarManifest<Report>> {
  const bytes = Buffer.from(input.bytes);
  if (bytes.length === 0) {
    throw new AvatarStorageError('Avatar asset must not be empty.');
  }
  if (typeof input.originalFilename !== 'string') {
    throw new AvatarStorageError('Avatar filename is invalid.');
  }

  const root = storageRoot(options);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const report = cloneJsonValue(input.report) as Report;
  const uploadedAt = (options?.now?.() ?? new Date()).toISOString();
  const manifest: AvatarManifest<Report> = {
    sha256,
    filename: sanitizeOriginalFilename(input.originalFilename),
    size: bytes.length,
    uploadedAt,
    report,
    modelUrl: modelUrl(sha256),
  };

  await writeVersionOnce(root, sha256, bytes);
  await writeCurrentManifestAtomically(root, manifest);
  return manifest;
}
