import 'server-only';

import { z } from 'zod';
import { HermesClientError, HermesConfigError } from './errors';
import {
  hermesCreateResponseSchema,
  hermesCancelResponseSchema,
  hermesPayloadSchemas,
  hermesStatusResponseSchema,
  HERMES_TRANSLATION_CONTEXT,
  type HermesCreateResponse,
  type HermesCancelResponse,
  type HermesJobType,
  type HermesKnowledgePayload,
  type HermesPayloadByType,
  type HermesStatusResponse,
  type HermesTranslationPayload,
} from './schemas';

export const HERMES_DEFAULT_TIMEOUT_MS = 5_000;
export const HERMES_MIN_TIMEOUT_MS = 100;
export const HERMES_MAX_TIMEOUT_MS = 10_000;
const HERMES_MAX_RESPONSE_BYTES = 64 * 1024;
const HERMES_MAX_RETRY_AFTER_SECONDS = 60;

export type DisabledHermesConfig = { enabled: false };
export type EnabledHermesConfig = {
  enabled: true;
  baseUrl: string;
  producerSecret: string;
  timeoutMs: number;
};
export type HermesConfig = DisabledHermesConfig | EnabledHermesConfig;

const enabledSchema = z.enum(['true', 'false']);
const timeoutSchema = z.coerce
  .number()
  .int()
  .min(HERMES_MIN_TIMEOUT_MS)
  .max(HERMES_MAX_TIMEOUT_MS);

function isTestLocalhost(url: URL, nodeEnv: string | undefined): boolean {
  if (nodeEnv !== 'test' || url.protocol !== 'http:') return false;
  return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname.toLowerCase());
}

export function validateHermesBaseUrl(rawUrl: string, nodeEnv?: string): string {
  if (!rawUrl || rawUrl.length > 2_048) {
    throw new HermesConfigError('HERMES_EDGE_BRIDGE_URL is not a valid absolute URL.');
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new HermesConfigError('HERMES_EDGE_BRIDGE_URL is not a valid absolute URL.');
  }

  if (url.protocol !== 'https:' && !isTestLocalhost(url, nodeEnv)) {
    throw new HermesConfigError('HERMES_EDGE_BRIDGE_URL must use HTTPS.');
  }
  if (url.username || url.password) {
    throw new HermesConfigError('HERMES_EDGE_BRIDGE_URL must not contain credentials.');
  }
  if (url.search || url.hash) {
    throw new HermesConfigError('HERMES_EDGE_BRIDGE_URL must not contain a query or fragment.');
  }

  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.toString();
}

export function readHermesConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
  nodeEnv: string | undefined = process.env.NODE_ENV
): HermesConfig {
  const enabledResult = enabledSchema.safeParse(env.HERMES_EDGE_BRIDGE_ENABLED ?? 'false');
  if (!enabledResult.success) {
    throw new HermesConfigError('HERMES_EDGE_BRIDGE_ENABLED must be true or false.');
  }
  if (enabledResult.data === 'false') return { enabled: false };

  const rawUrl = env.HERMES_EDGE_BRIDGE_URL;
  const producerSecret = env.HERMES_EDGE_PRODUCER_SECRET;
  if (!rawUrl) {
    throw new HermesConfigError('HERMES_EDGE_BRIDGE_URL is required when Hermes is enabled.');
  }
  if (
    !producerSecret ||
    producerSecret.length > 4_096 ||
    !/^[\x21-\x7e]+$/.test(producerSecret)
  ) {
    throw new HermesConfigError(
      'HERMES_EDGE_PRODUCER_SECRET is required when Hermes is enabled.'
    );
  }

  const timeoutResult = timeoutSchema.safeParse(
    env.HERMES_EDGE_BRIDGE_TIMEOUT_MS ?? HERMES_DEFAULT_TIMEOUT_MS
  );
  if (!timeoutResult.success) {
    throw new HermesConfigError('HERMES_EDGE_BRIDGE_TIMEOUT_MS is outside the allowed range.');
  }

  return {
    enabled: true,
    baseUrl: validateHermesBaseUrl(rawUrl, nodeEnv),
    producerSecret,
    timeoutMs: timeoutResult.data,
  };
}

function endpointUrl(baseUrl: string, path: string): string {
  const endpoint = new URL(baseUrl);
  const basePath = endpoint.pathname.replace(/\/+$/, '');
  endpoint.pathname = `${basePath}${path}`;
  return endpoint.toString();
}

function isJsonResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  return contentType.includes('application/json') || contentType.includes('+json');
}

export class HermesClient {
  private readonly config: EnabledHermesConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(
    config: EnabledHermesConfig,
    fetchImpl: typeof fetch = globalThis.fetch
  ) {
    if (
      !Number.isInteger(config.timeoutMs) ||
      config.timeoutMs < HERMES_MIN_TIMEOUT_MS ||
      config.timeoutMs > HERMES_MAX_TIMEOUT_MS
    ) {
      throw new HermesConfigError('Hermes client timeout is outside the allowed range.');
    }
    if (
      !config.producerSecret ||
      config.producerSecret.length > 4_096 ||
      !/^[\x21-\x7e]+$/.test(config.producerSecret)
    ) {
      throw new HermesConfigError('Hermes producer secret is invalid.');
    }

    this.config = {
      ...config,
      baseUrl: validateHermesBaseUrl(config.baseUrl, process.env.NODE_ENV),
    };
    this.fetchImpl = fetchImpl;
  }

  async createJob<T extends HermesJobType>(
    type: T,
    payload: HermesPayloadByType[T],
    idempotencyKey: string
  ): Promise<HermesCreateResponse> {
    const parsedPayload = hermesPayloadSchemas[type].safeParse(payload);
    if (!parsedPayload.success) {
      throw new HermesClientError(
        'invalid_response',
        'Hermes request validation failed before submission.'
      );
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(idempotencyKey)) {
      throw new HermesClientError(
        'invalid_response',
        'Hermes request validation failed before submission.'
      );
    }

    const relayPayload = type === 'translate'
      ? (() => {
          const translation = parsedPayload.data as HermesTranslationPayload;
          return {
            text: translation.input,
            source_language: translation.source_language ?? 'auto',
            target_language: translation.target_language,
            context: HERMES_TRANSLATION_CONTEXT,
          };
        })()
      : (() => {
          const knowledge = parsedPayload.data as HermesKnowledgePayload;
          return {
            question: knowledge.prompt,
            context_chunks: knowledge.context_chunks,
            collection: 'judy-travel',
          };
        })();

    return this.request(
      '/v1/jobs',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.config.producerSecret}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ type, payload: relayPayload }),
      },
      hermesCreateResponseSchema
    );
  }

  async getJob(bridgeJobId: string): Promise<HermesStatusResponse> {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(bridgeJobId)) {
      throw new HermesClientError('invalid_response', 'Hermes service returned an invalid response.');
    }

    return this.request(
      `/v1/jobs/${encodeURIComponent(bridgeJobId)}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.config.producerSecret}`,
        },
      },
      hermesStatusResponseSchema
    );
  }

  async cancelJob(bridgeJobId: string): Promise<HermesCancelResponse> {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(bridgeJobId)) {
      throw new HermesClientError('invalid_response', 'Hermes service returned an invalid response.');
    }

    return this.request(
      `/v1/jobs/${encodeURIComponent(bridgeJobId)}`,
      {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.config.producerSecret}`,
        },
      },
      hermesCancelResponseSchema
    );
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    schema: z.ZodType<T>
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await this.fetchImpl(endpointUrl(this.config.baseUrl, path), {
        ...init,
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfterHeader = response.headers.get('retry-after');
          const rawRetryAfter = retryAfterHeader === null ? NaN : Number(retryAfterHeader);
          const retryAfterSeconds = Number.isFinite(rawRetryAfter)
            ? Math.min(
                HERMES_MAX_RETRY_AFTER_SECONDS,
                Math.max(1, Math.ceil(rawRetryAfter))
              )
            : 5;
          throw new HermesClientError(
            'rate_limited',
            'Hermes service is busy. Please retry shortly.',
            429,
            retryAfterSeconds
          );
        }
        throw new HermesClientError('upstream_status', 'Hermes service request failed.');
      }
      if (!isJsonResponse(response)) {
        throw new HermesClientError(
          'invalid_response',
          'Hermes service returned an invalid response.'
        );
      }

      const declaredLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(declaredLength) && declaredLength > HERMES_MAX_RESPONSE_BYTES) {
        throw new HermesClientError(
          'invalid_response',
          'Hermes service returned an invalid response.'
        );
      }

      const text = await response.text();
      if (new TextEncoder().encode(text).byteLength > HERMES_MAX_RESPONSE_BYTES) {
        throw new HermesClientError(
          'invalid_response',
          'Hermes service returned an invalid response.'
        );
      }

      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        throw new HermesClientError(
          'invalid_response',
          'Hermes service returned an invalid response.'
        );
      }

      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        throw new HermesClientError(
          'invalid_response',
          'Hermes service returned an invalid response.'
        );
      }
      return parsed.data;
    } catch (error) {
      if (error instanceof HermesClientError) throw error;
      if (controller.signal.aborted) {
        throw new HermesClientError('timeout', 'Hermes service timed out.', 504);
      }
      throw new HermesClientError('network', 'Hermes service request failed.');
    } finally {
      clearTimeout(timeout);
    }
  }
}
