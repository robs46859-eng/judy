import { describe, expect, it, vi } from 'vitest';
import {
  HermesClient,
  readHermesConfig,
  validateHermesBaseUrl,
  type EnabledHermesConfig,
} from '../client';
import { HermesClientError, HermesConfigError } from '../errors';

const localId = '00000000-0000-4000-8000-000000000001';

function config(overrides: Partial<EnabledHermesConfig> = {}): EnabledHermesConfig {
  return {
    enabled: true,
    baseUrl: 'https://relay.example.test/',
    producerSecret: 'test-double',
    timeoutMs: 1_000,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Hermes configuration', () => {
  it('is disabled by default without requiring URL or secret values', () => {
    expect(readHermesConfig({}, 'production')).toEqual({ enabled: false });
  });

  it('requires HTTPS and only permits HTTP localhost in tests', () => {
    expect(() =>
      readHermesConfig(
        {
          HERMES_EDGE_BRIDGE_ENABLED: 'true',
          HERMES_EDGE_BRIDGE_URL: 'http://relay.example.test',
          HERMES_EDGE_PRODUCER_SECRET: 'test-double',
        },
        'production'
      )
    ).toThrow(HermesConfigError);

    expect(
      validateHermesBaseUrl('http://localhost:8787/base/', 'test')
    ).toBe('http://localhost:8787/base');
    expect(() =>
      validateHermesBaseUrl('http://localhost.example.test', 'test')
    ).toThrow(HermesConfigError);
  });

  it('rejects URL credentials, query strings, fragments, and out-of-range timeouts', () => {
    expect(() => validateHermesBaseUrl('https://marker@relay.example.test')).toThrow(
      HermesConfigError
    );
    expect(() => validateHermesBaseUrl('https://relay.example.test/?mode=test')).toThrow(
      HermesConfigError
    );
    expect(() => validateHermesBaseUrl('https://relay.example.test/#part')).toThrow(
      HermesConfigError
    );
    expect(() =>
      readHermesConfig(
        {
          HERMES_EDGE_BRIDGE_ENABLED: 'true',
          HERMES_EDGE_BRIDGE_URL: 'https://relay.example.test',
          HERMES_EDGE_PRODUCER_SECRET: 'test-double',
          HERMES_EDGE_BRIDGE_TIMEOUT_MS: '10001',
        },
        'production'
      )
    ).toThrow(HermesConfigError);
  });
});

describe('HermesClient', () => {
  it('sends the producer contract with auth, idempotency, and redirects disabled', async () => {
    const fetchMock = vi.fn(
      async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        expect(String(input)).toBe('https://relay.example.test/base/v1/jobs');
        expect(init?.method).toBe('POST');
        expect(init?.redirect).toBe('error');
        expect(init?.credentials).toBe('omit');

        const headers = new Headers(init?.headers);
        expect(headers.get('authorization')).toBe('Bearer test-double');
        expect(headers.get('idempotency-key')).toBe(localId);
        expect(JSON.parse(String(init?.body))).toEqual({
          type: 'translate',
          payload: {
            text: 'Hello',
            source_language: 'auto',
            target_language: 'es',
            context: 'Judy travel application translation',
          },
        });
        return jsonResponse({ job_id: 'bridge-job', status: 'queued' });
      }
    );
    const client = new HermesClient(
      config({ baseUrl: 'https://relay.example.test/base' }),
      fetchMock as typeof fetch
    );

    await expect(
      client.createJob('translate', { input: 'Hello', target_language: 'es' }, localId)
    ).resolves.toEqual({ job_id: 'bridge-job', status: 'queued' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('maps grounded Judy knowledge input to the worker contract', async () => {
    const fetchMock = vi.fn(
      async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        expect(JSON.parse(String(init?.body))).toEqual({
          type: 'knowledge',
          payload: {
            question: 'Where should I stay?',
            context_chunks: ['The user prefers a walkable neighborhood near transit.'],
            collection: 'judy-travel',
          },
        });
        return jsonResponse({ job_id: 'bridge-knowledge', status: 'queued' });
      }
    );
    const client = new HermesClient(config(), fetchMock as typeof fetch);

    await expect(
      client.createJob(
        'knowledge',
        {
          prompt: 'Where should I stay?',
          context_chunks: ['The user prefers a walkable neighborhood near transit.'],
        },
        localId
      )
    ).resolves.toEqual({ job_id: 'bridge-knowledge', status: 'queued' });
  });

  it('rejects malformed upstream envelopes without exposing their contents', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ job_id: 'bridge-job', status: 'queued', internal: 'do-not-return' })
    );
    const client = new HermesClient(config(), fetchMock as typeof fetch);

    const error = await client
      .createJob(
        'knowledge',
        { prompt: 'Summarize this.', context_chunks: ['Grounded travel context.'] },
        localId
      )
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HermesClientError);
    expect(error).toMatchObject({
      code: 'invalid_response',
      publicMessage: 'Hermes service returned an invalid response.',
    });
    expect(String(error)).not.toContain('do-not-return');
  });

  it('aborts at the configured timeout and returns a sanitized error', async () => {
    const fetchMock = vi.fn(
      (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true,
          });
        })
    );
    const client = new HermesClient(config({ timeoutMs: 100 }), fetchMock as typeof fetch);

    await expect(
      client.createJob(
        'knowledge',
        { prompt: 'Question', context_chunks: ['Grounded travel context.'] },
        localId
      )
    ).rejects.toMatchObject({
      code: 'timeout',
      publicMessage: 'Hermes service timed out.',
      httpStatus: 504,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not include upstream response bodies or URLs in HTTP errors', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ error: 'details at https://internal.example.test/path' }, 502)
    );
    const client = new HermesClient(config(), fetchMock as typeof fetch);

    const error = await client
      .getJob('bridge-job')
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: 'upstream_status',
      publicMessage: 'Hermes service request failed.',
    });
    expect(String(error)).not.toContain('internal.example.test');
  });

  it('preserves a bounded Retry-After value from bridge rate limits', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'slow down' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '120' },
      })
    );
    const client = new HermesClient(config(), fetchMock as typeof fetch);

    await expect(client.getJob('bridge-job')).rejects.toMatchObject({
      code: 'rate_limited',
      httpStatus: 429,
      retryAfterSeconds: 60,
      publicMessage: 'Hermes service is busy. Please retry shortly.',
    });
  });

  it('cancels a queued bridge job without sending a request body', async () => {
    const fetchMock = vi.fn(
      async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        expect(String(input)).toBe('https://relay.example.test/v1/jobs/bridge-job');
        expect(init?.method).toBe('DELETE');
        expect(init?.body).toBeUndefined();
        return jsonResponse({ job_id: 'bridge-job', status: 'failed', canceled: true });
      }
    );
    const client = new HermesClient(config(), fetchMock as typeof fetch);

    await expect(client.cancelJob('bridge-job')).resolves.toEqual({
      job_id: 'bridge-job',
      status: 'failed',
      canceled: true,
    });
  });
});
