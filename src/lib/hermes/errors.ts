const DEFAULT_JOB_ERROR = 'Hermes job failed.';
const MAX_STORED_ERROR_CHARS = 500;

export class HermesConfigError extends Error {
  readonly publicMessage = 'Hermes service is unavailable.';
  readonly httpStatus = 503;

  constructor(message: string) {
    super(message);
    this.name = 'HermesConfigError';
  }
}

export type HermesClientErrorCode =
  | 'network'
  | 'timeout'
  | 'rate_limited'
  | 'upstream_status'
  | 'invalid_response';

export class HermesClientError extends Error {
  constructor(
    readonly code: HermesClientErrorCode,
    readonly publicMessage: string,
    readonly httpStatus: 429 | 502 | 504 = 502,
    readonly retryAfterSeconds?: number
  ) {
    super(publicMessage);
    this.name = 'HermesClientError';
  }
}

export class HermesQuotaError extends Error {
  readonly httpStatus = 429;

  constructor(
    readonly scope: 'user' | 'ip' | 'daily',
    readonly retryAfterSeconds: number,
    message = 'Hermes request quota exceeded.'
  ) {
    super(message);
    this.name = 'HermesQuotaError';
  }
}

export class HermesNotFoundError extends Error {
  readonly httpStatus = 404;

  constructor() {
    super('Hermes job not found.');
    this.name = 'HermesNotFoundError';
  }
}

export class HermesSubmissionError extends Error {
  constructor(
    readonly localJobId: string,
    readonly publicMessage: string,
    readonly httpStatus: 429 | 502 | 504,
    readonly retryAfterSeconds?: number
  ) {
    super(publicMessage);
    this.name = 'HermesSubmissionError';
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function sanitizeHermesJobError(
  value: unknown,
  redactedValues: readonly string[] = []
): string {
  if (typeof value !== 'string') return DEFAULT_JOB_ERROR;

  let sanitized = value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/https?:\/\/\S+/gi, '[redacted-url]')
    .replace(/\bbearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(
      /\b(api[\s_-]?key|token|secret|password)\b\s*[:=]\s*[^\s,;]+/gi,
      '$1=[redacted]'
    );

  for (const redactedValue of redactedValues) {
    if (!redactedValue) continue;
    sanitized = sanitized.replace(new RegExp(escapeRegExp(redactedValue), 'g'), '[redacted]');
  }

  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  if (!sanitized) return DEFAULT_JOB_ERROR;
  return sanitized.slice(0, MAX_STORED_ERROR_CHARS);
}

export function publicClientError(error: unknown): {
  message: string;
  status: 429 | 502 | 504;
  retryAfterSeconds?: number;
} {
  if (error instanceof HermesClientError) {
    return {
      message: error.publicMessage,
      status: error.httpStatus,
      retryAfterSeconds: error.retryAfterSeconds,
    };
  }
  return { message: 'Hermes service request failed.', status: 502 };
}
