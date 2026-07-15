import { randomUUID } from 'node:crypto';
import {
  HermesClientError,
  HermesNotFoundError,
  HermesQuotaError,
  HermesSubmissionError,
  publicClientError,
  sanitizeHermesJobError,
} from './errors';
import {
  consumeHermesMinuteQuotas,
  type HermesMinuteQuotaStore,
  HERMES_DAILY_LIMITS,
  secondsUntilUtcDayEnd,
  utcDayRange,
} from './quotas';
import {
  normalizeHermesStatus,
  type HermesCreateResponse,
  type HermesJobStatus,
  type HermesJobType,
  type HermesJsonValue,
  type HermesPayloadByType,
  type HermesStatusResponse,
} from './schemas';

export type HermesJobRecord = {
  id: string;
  userId: string;
  bridgeJobId: string | null;
  type: HermesJobType;
  status: HermesJobStatus;
  resultJson: HermesJsonValue | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ReserveHermesJobInput = {
  id: string;
  userId: string;
  type: HermesJobType;
  status: HermesJobStatus;
  createdAt: Date;
  dayStart: Date;
  dayEnd: Date;
  dailyLimit: number;
};

export interface HermesJobStore extends HermesMinuteQuotaStore {
  reserveJob(input: ReserveHermesJobInput): Promise<HermesJobRecord | null>;
  findOwnedJob(id: string, userId: string): Promise<HermesJobRecord | null>;
  attachBridgeJob(
    id: string,
    bridgeJobId: string,
    status: HermesJobStatus
  ): Promise<HermesJobRecord>;
  transitionJob(
    id: string,
    data: {
      status: HermesJobStatus;
      resultJson: HermesJsonValue | null;
      error: string | null;
    }
  ): Promise<HermesJobRecord>;
}

export interface HermesClientPort {
  createJob<T extends HermesJobType>(
    type: T,
    payload: HermesPayloadByType[T],
    idempotencyKey: string
  ): Promise<HermesCreateResponse>;
  getJob(bridgeJobId: string): Promise<HermesStatusResponse>;
}

export type PublicHermesJob = {
  job_id: string;
  status: HermesJobStatus;
  result: HermesJsonValue | null;
  error: string | null;
};

type HermesServiceOptions = {
  store: HermesJobStore;
  client: HermesClientPort;
  now?: () => Date;
  idFactory?: () => string;
};

function publicJob(job: HermesJobRecord): PublicHermesJob {
  return {
    job_id: job.id,
    status: job.status,
    result: job.resultJson,
    error: job.error,
  };
}

function isTerminal(status: HermesJobStatus): boolean {
  return status === 'succeeded' || status === 'failed';
}

export function canTransitionHermesJobStatus(
  current: HermesJobStatus,
  next: HermesJobStatus
): boolean {
  if (isTerminal(current)) return false;
  if (current === 'running' && next === 'queued') return false;
  return true;
}

export function hermesTransitionSourceStatuses(
  next: HermesJobStatus
): Array<'queued' | 'running'> {
  return next === 'queued' ? ['queued'] : ['queued', 'running'];
}

function jsonContainsPrivateId(value: HermesJsonValue, privateId: string): boolean {
  if (typeof value === 'string') return value.includes(privateId);
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) {
    return value.some((item) => jsonContainsPrivateId(item, privateId));
  }
  return Object.entries(value).some(
    ([key, item]) => key.includes(privateId) || jsonContainsPrivateId(item, privateId)
  );
}

export class HermesService {
  private readonly store: HermesJobStore;
  private readonly client: HermesClientPort;
  private readonly now: () => Date;
  private readonly idFactory: () => string;

  constructor(options: HermesServiceOptions) {
    this.store = options.store;
    this.client = options.client;
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory ?? randomUUID;
  }

  async createJob<T extends HermesJobType>(input: {
    userId: string;
    networkKey: string;
    type: T;
    payload: HermesPayloadByType[T];
  }): Promise<PublicHermesJob> {
    await this.enforceMinuteQuota('create', input.userId, input.networkKey);

    const now = this.now();
    const day = utcDayRange(now);
    const localJobId = this.idFactory();
    const localJob = await this.store.reserveJob({
      id: localJobId,
      userId: input.userId,
      type: input.type,
      status: 'queued',
      createdAt: now,
      dayStart: day.start,
      dayEnd: day.end,
      dailyLimit: HERMES_DAILY_LIMITS[input.type],
    });

    if (!localJob) {
      throw new HermesQuotaError('daily', secondsUntilUtcDayEnd(now));
    }

    try {
      const upstream = await this.client.createJob(
        input.type,
        input.payload,
        localJob.id
      );
      const normalized = normalizeHermesStatus(upstream.status);
      const status = isTerminal(normalized) ? 'running' : normalized;
      const attached = await this.store.attachBridgeJob(
        localJob.id,
        upstream.job_id,
        status
      );
      return publicJob(attached);
    } catch (error) {
      const clientError = publicClientError(error);
      const safeError = sanitizeHermesJobError(clientError.message);
      await this.store.transitionJob(localJob.id, {
        status: 'failed',
        resultJson: null,
        error: safeError,
      });
      throw new HermesSubmissionError(localJob.id, safeError, clientError.status);
    }
  }

  async getJob(input: {
    userId: string;
    networkKey: string;
    localJobId: string;
  }): Promise<PublicHermesJob> {
    await this.enforceMinuteQuota('status', input.userId, input.networkKey);

    const localJob = await this.store.findOwnedJob(input.localJobId, input.userId);
    if (!localJob) throw new HermesNotFoundError();

    if (isTerminal(localJob.status) || !localJob.bridgeJobId) {
      return publicJob(localJob);
    }

    const upstream = await this.client.getJob(localJob.bridgeJobId);
    const status = normalizeHermesStatus(upstream.status);

    if (status === 'succeeded' && (upstream.result === undefined || upstream.result === null)) {
      throw new HermesClientError(
        'invalid_response',
        'Hermes service returned an invalid response.'
      );
    }
    if (
      status === 'succeeded' &&
      upstream.result !== undefined &&
      upstream.result !== null &&
      jsonContainsPrivateId(upstream.result, localJob.bridgeJobId)
    ) {
      throw new HermesClientError(
        'invalid_response',
        'Hermes service returned an invalid response.'
      );
    }

    const updated = await this.store.transitionJob(localJob.id, {
      status,
      resultJson: status === 'succeeded' ? upstream.result ?? null : null,
      error:
        status === 'failed'
          ? sanitizeHermesJobError(upstream.error, [localJob.bridgeJobId])
          : null,
    });
    return publicJob(updated);
  }

  private async enforceMinuteQuota(
    action: 'create' | 'status',
    userId: string,
    networkKey: string
  ): Promise<void> {
    const quota = await consumeHermesMinuteQuotas(
      this.store,
      action,
      userId,
      networkKey,
      this.now()
    );
    if (!quota.ok) {
      throw new HermesQuotaError(
        quota.blockedScope ?? 'user',
        quota.retryAfterSeconds
      );
    }
  }
}
