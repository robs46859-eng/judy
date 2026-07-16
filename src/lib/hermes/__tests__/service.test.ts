import { describe, expect, it, vi } from 'vitest';
import { HermesNotFoundError, HermesQuotaError } from '../errors';
import type { ConsumeHermesMinuteQuotaInput, MinuteQuotaResult } from '../quotas';
import {
  canTransitionHermesJobStatus,
  HermesService,
  type HermesClientPort,
  type HermesJobRecord,
  type HermesJobStore,
  type ReserveHermesJobInput,
} from '../service';
import type {
  HermesCreateResponse,
  HermesCancelResponse,
  HermesJobStatus,
  HermesJobType,
  HermesJsonValue,
  HermesPayloadByType,
  HermesStatusResponse,
} from '../schemas';

const now = new Date('2026-07-15T12:00:00.000Z');
const localId = '00000000-0000-4000-8000-000000000001';

function cloneJob(job: HermesJobRecord): HermesJobRecord {
  return { ...job };
}

class MemoryStore implements HermesJobStore {
  readonly jobs = new Map<string, HermesJobRecord>();
  readonly quotaBuckets = new Map<string, { windowStart: string; count: number }>();
  readonly events: string[] = [];
  reserveCalls = 0;
  findCalls = 0;

  addJob(input: Partial<HermesJobRecord> & Pick<HermesJobRecord, 'id' | 'userId' | 'type'>) {
    this.jobs.set(input.id, {
      id: input.id,
      userId: input.userId,
      bridgeJobId: input.bridgeJobId ?? null,
      type: input.type,
      status: input.status ?? 'queued',
      resultJson: input.resultJson ?? null,
      error: input.error ?? null,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    });
  }

  async consumeMinuteQuota(
    input: ConsumeHermesMinuteQuotaInput
  ): Promise<MinuteQuotaResult> {
    this.events.push('quota');
    const current = this.quotaBuckets.get(input.key);
    const count = current?.windowStart === input.windowStart ? current.count : 0;
    if (count >= input.limit) {
      return {
        ok: false,
        remaining: 0,
        retryAfterSeconds: input.retryAfterSeconds,
      };
    }

    const nextCount = count + 1;
    this.quotaBuckets.set(input.key, { windowStart: input.windowStart, count: nextCount });
    return { ok: true, remaining: input.limit - nextCount, retryAfterSeconds: 0 };
  }

  async reserveJob(input: ReserveHermesJobInput): Promise<HermesJobRecord | null> {
    this.events.push('reserve');
    this.reserveCalls += 1;
    const count = [...this.jobs.values()].filter(
      (job) =>
        job.userId === input.userId &&
        job.type === input.type &&
        job.createdAt >= input.dayStart &&
        job.createdAt < input.dayEnd
    ).length;
    if (count >= input.dailyLimit) return null;

    this.addJob({
      id: input.id,
      userId: input.userId,
      type: input.type,
      status: input.status,
      createdAt: input.createdAt,
    });
    return cloneJob(this.requiredJob(input.id));
  }

  async findOwnedJob(id: string, userId: string): Promise<HermesJobRecord | null> {
    this.events.push('find');
    this.findCalls += 1;
    const job = this.jobs.get(id);
    return job?.userId === userId ? cloneJob(job) : null;
  }

  async attachBridgeJob(
    id: string,
    bridgeJobId: string,
    status: HermesJobStatus
  ): Promise<HermesJobRecord> {
    const job = this.requiredJob(id);
    if (canTransitionHermesJobStatus(job.status, status)) {
      Object.assign(job, { bridgeJobId, status, updatedAt: now });
    }
    return cloneJob(job);
  }

  async transitionJob(
    id: string,
    data: { status: HermesJobStatus; resultJson: HermesJsonValue | null; error: string | null }
  ): Promise<HermesJobRecord> {
    const job = this.requiredJob(id);
    if (canTransitionHermesJobStatus(job.status, data.status)) {
      Object.assign(job, data, { updatedAt: now });
    }
    return cloneJob(job);
  }

  private requiredJob(id: string): HermesJobRecord {
    const job = this.jobs.get(id);
    if (!job) throw new Error('Test job is missing.');
    return job;
  }
}

class CountingClient implements HermesClientPort {
  readonly createCalls: Array<{ type: HermesJobType; idempotencyKey: string }> = [];
  readonly getCalls: string[] = [];
  createResponse: HermesCreateResponse = { job_id: 'bridge-private', status: 'queued' };
  statusResponse: HermesStatusResponse = { status: 'running', result: null, error: null };
  statusHandler?: (bridgeJobId: string) => Promise<HermesStatusResponse>;

  async createJob<T extends HermesJobType>(
    type: T,
    _payload: HermesPayloadByType[T],
    idempotencyKey: string
  ): Promise<HermesCreateResponse> {
    this.createCalls.push({ type, idempotencyKey });
    return this.createResponse;
  }

  async getJob(bridgeJobId: string): Promise<HermesStatusResponse> {
    this.getCalls.push(bridgeJobId);
    return this.statusHandler ? this.statusHandler(bridgeJobId) : this.statusResponse;
  }

  async cancelJob(bridgeJobId: string): Promise<HermesCancelResponse> {
    this.getCalls.push(`cancel:${bridgeJobId}`);
    return { job_id: bridgeJobId, status: 'failed', canceled: true };
  }
}

function createService(store: MemoryStore, client: CountingClient, idFactory = () => localId) {
  return new HermesService({
    store,
    client,
    now: () => now,
    idFactory,
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('HermesService create flow', () => {
  it('stores the private bridge ID but returns only the local ID', async () => {
    const store = new MemoryStore();
    const client = new CountingClient();
    const service = createService(store, client);

    const result = await service.createJob({
      userId: 'user-a',
      networkKey: 'ip:192.0.2.1',
      type: 'translate',
      payload: { input: 'Hello', target_language: 'fr' },
    });

    expect(result).toEqual({ job_id: localId, status: 'queued', result: null, error: null });
    expect(JSON.stringify(result)).not.toContain('bridge-private');
    expect(store.jobs.get(localId)?.bridgeJobId).toBe('bridge-private');
    expect(client.createCalls).toEqual([{ type: 'translate', idempotencyKey: localId }]);
  });

  it('checks the shared minute quota, then the DB daily cap, before any upstream call', async () => {
    const store = new MemoryStore();
    const client = new CountingClient();
    for (let index = 0; index < 20; index += 1) {
      store.addJob({
        id: `existing-${index}`,
        userId: 'user-a',
        type: 'translate',
        createdAt: now,
      });
    }
    let nextId = 0;
    const service = createService(store, client, () => `local-${nextId++}`);

    for (let index = 0; index < 5; index += 1) {
      await expect(
        service.createJob({
          userId: 'user-a',
          networkKey: 'ip:192.0.2.2',
          type: 'translate',
          payload: { input: 'Hello', target_language: 'fr' },
        })
      ).rejects.toMatchObject({ scope: 'daily' });
    }
    expect(store.reserveCalls).toBe(5);
    expect(client.createCalls).toHaveLength(0);

    await expect(
      service.createJob({
        userId: 'user-a',
        networkKey: 'ip:192.0.2.2',
        type: 'translate',
        payload: { input: 'Hello', target_language: 'fr' },
      })
    ).rejects.toMatchObject({ scope: 'user' });
    expect(store.reserveCalls).toBe(5);
    expect(client.createCalls).toHaveLength(0);
  });

  it('shares minute usage across independent service instances', async () => {
    const store = new MemoryStore();
    const firstClient = new CountingClient();
    const secondClient = new CountingClient();
    let nextId = 0;
    const idFactory = () => `local-${nextId++}`;
    const first = createService(store, firstClient, idFactory);
    const second = createService(store, secondClient, idFactory);

    for (let index = 0; index < 5; index += 1) {
      await (index % 2 === 0 ? first : second).createJob({
        userId: 'user-a',
        networkKey: 'ip:192.0.2.3',
        type: 'knowledge',
        payload: { prompt: 'Question', context_chunks: ['Context'] },
      });
    }

    await expect(
      second.createJob({
        userId: 'user-a',
        networkKey: 'ip:192.0.2.3',
        type: 'knowledge',
        payload: { prompt: 'Question', context_chunks: ['Context'] },
      })
    ).rejects.toMatchObject({ scope: 'user' });
  });
});

describe('HermesService status flow', () => {
  it('cancels an owned nonterminal bridge job and records a safe local failure', async () => {
    const store = new MemoryStore();
    const client = new CountingClient();
    store.addJob({
      id: localId,
      userId: 'user-a',
      type: 'knowledge',
      bridgeJobId: 'bridge-private',
      status: 'queued',
    });
    const service = createService(store, client);

    const result = await service.cancelJob({
      userId: 'user-a',
      networkKey: 'ip:198.51.100.1',
      localJobId: localId,
    });

    expect(result).toEqual({
      job_id: localId,
      status: 'failed',
      result: null,
      error: 'Timed out and canceled before processing.',
    });
    expect(client.getCalls).toEqual(['cancel:bridge-private']);
  });

  it('checks quota before owner lookup and returns the same 404 for another user', async () => {
    const store = new MemoryStore();
    const client = new CountingClient();
    store.addJob({
      id: localId,
      userId: 'user-a',
      type: 'knowledge',
      bridgeJobId: 'bridge-private',
      status: 'running',
    });
    const service = createService(store, client);

    await expect(
      service.getJob({
        userId: 'user-b',
        networkKey: 'ip:198.51.100.1',
        localJobId: localId,
      })
    ).rejects.toBeInstanceOf(HermesNotFoundError);
    expect(store.events.slice(0, 3)).toEqual(['quota', 'quota', 'find']);
    expect(client.getCalls).toHaveLength(0);
  });

  it('persists a validated final result for the owner without disclosing the bridge ID', async () => {
    const store = new MemoryStore();
    const client = new CountingClient();
    client.statusResponse = {
      status: 'completed',
      result: { answer: 'A concise result.', citations: [] },
      error: null,
    };
    store.addJob({
      id: localId,
      userId: 'user-a',
      type: 'knowledge',
      bridgeJobId: 'bridge-private',
      status: 'running',
    });
    const service = createService(store, client);

    const result = await service.getJob({
      userId: 'user-a',
      networkKey: 'ip:198.51.100.1',
      localJobId: localId,
    });

    expect(result).toEqual({
      job_id: localId,
      status: 'succeeded',
      result: { answer: 'A concise result.', citations: [] },
      error: null,
    });
    expect(JSON.stringify(result)).not.toContain('bridge-private');
    expect(store.jobs.get(localId)?.status).toBe('succeeded');
    expect(client.getCalls).toEqual(['bridge-private']);
  });

  it('sanitizes final upstream errors before persistence or return', async () => {
    const store = new MemoryStore();
    const client = new CountingClient();
    client.statusResponse = {
      status: 'failed',
      result: null,
      error: 'Worker bridge-private could not reach https://internal.example.test/path',
    };
    store.addJob({
      id: localId,
      userId: 'user-a',
      type: 'translate',
      bridgeJobId: 'bridge-private',
      status: 'running',
    });
    const service = createService(store, client);

    const result = await service.getJob({
      userId: 'user-a',
      networkKey: 'ip:203.0.113.2',
      localJobId: localId,
    });

    expect(result.status).toBe('failed');
    expect(result.error).not.toContain('bridge-private');
    expect(result.error).not.toContain('internal.example.test');
    expect(store.jobs.get(localId)?.error).toBe(result.error);
  });

  it('rejects a nested result containing the private bridge ID', async () => {
    const store = new MemoryStore();
    const client = new CountingClient();
    client.statusResponse = {
      status: 'completed',
      result: { metadata: { source_job: 'bridge-private' } },
      error: null,
    };
    store.addJob({
      id: localId,
      userId: 'user-a',
      type: 'knowledge',
      bridgeJobId: 'bridge-private',
      status: 'running',
    });
    const service = createService(store, client);

    await expect(
      service.getJob({
        userId: 'user-a',
        networkKey: 'ip:203.0.113.2',
        localJobId: localId,
      })
    ).rejects.toMatchObject({ code: 'invalid_response' });
    expect(store.jobs.get(localId)?.resultJson).toBeNull();
    expect(store.jobs.get(localId)?.status).toBe('running');
  });

  it('does not let a stale concurrent relay response overwrite a completed result', async () => {
    const store = new MemoryStore();
    const client = new CountingClient();
    const completed = deferred<HermesStatusResponse>();
    const stale = deferred<HermesStatusResponse>();
    const responses = [completed.promise, stale.promise];
    client.statusHandler = async () => responses.shift() ?? stale.promise;
    store.addJob({
      id: localId,
      userId: 'user-a',
      type: 'knowledge',
      bridgeJobId: 'bridge-private',
      status: 'running',
    });
    const service = createService(store, client);

    const completedPoll = service.getJob({
      userId: 'user-a',
      networkKey: 'ip:203.0.113.3',
      localJobId: localId,
    });
    const stalePoll = service.getJob({
      userId: 'user-a',
      networkKey: 'ip:203.0.113.3',
      localJobId: localId,
    });
    await vi.waitFor(() => expect(client.getCalls).toHaveLength(2));

    completed.resolve({ status: 'completed', result: { answer: 'final' }, error: null });
    await expect(completedPoll).resolves.toMatchObject({
      status: 'succeeded',
      result: { answer: 'final' },
    });
    stale.resolve({ status: 'running', result: null, error: null });
    await expect(stalePoll).resolves.toMatchObject({
      status: 'succeeded',
      result: { answer: 'final' },
    });
    expect(store.jobs.get(localId)).toMatchObject({
      status: 'succeeded',
      resultJson: { answer: 'final' },
      error: null,
    });
  });

  it('keeps the first terminal state when terminal relay responses race', async () => {
    const store = new MemoryStore();
    const client = new CountingClient();
    const success = deferred<HermesStatusResponse>();
    const failure = deferred<HermesStatusResponse>();
    const responses = [success.promise, failure.promise];
    client.statusHandler = async () => responses.shift() ?? failure.promise;
    store.addJob({
      id: localId,
      userId: 'user-a',
      type: 'translate',
      bridgeJobId: 'bridge-private',
      status: 'running',
    });
    const service = createService(store, client);

    const successPoll = service.getJob({
      userId: 'user-a',
      networkKey: 'ip:203.0.113.4',
      localJobId: localId,
    });
    const failurePoll = service.getJob({
      userId: 'user-a',
      networkKey: 'ip:203.0.113.4',
      localJobId: localId,
    });
    await vi.waitFor(() => expect(client.getCalls).toHaveLength(2));

    failure.resolve({ status: 'failed', result: null, error: 'relay failed' });
    await expect(failurePoll).resolves.toMatchObject({ status: 'failed', error: 'relay failed' });
    success.resolve({ status: 'completed', result: { answer: 'late' }, error: null });
    await expect(successPoll).resolves.toMatchObject({ status: 'failed', error: 'relay failed' });
    expect(store.jobs.get(localId)).toMatchObject({
      status: 'failed',
      resultJson: null,
      error: 'relay failed',
    });
  });

  it('rate-limits malformed and missing IDs before another ownership lookup', async () => {
    const store = new MemoryStore();
    const client = new CountingClient();
    const service = createService(store, client);

    for (let index = 0; index < 60; index += 1) {
      await expect(
        service.getJob({
          userId: 'user-a',
          networkKey: 'ip:203.0.113.5',
          localJobId: `not-a-uuid-${index}`,
        })
      ).rejects.toBeInstanceOf(HermesNotFoundError);
    }
    expect(store.findCalls).toBe(60);

    await expect(
      service.getJob({
        userId: 'user-a',
        networkKey: 'ip:203.0.113.5',
        localJobId: 'still-not-a-uuid',
      })
    ).rejects.toBeInstanceOf(HermesQuotaError);
    expect(store.findCalls).toBe(60);
    expect(client.getCalls).toHaveLength(0);
  });
});
