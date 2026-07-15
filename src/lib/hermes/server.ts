import 'server-only';

import { Prisma, type HermesJob, type PrismaClient } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { HermesClient, readHermesConfig } from './client';
import { HermesConfigError } from './errors';
import type { ConsumeHermesMinuteQuotaInput, MinuteQuotaResult } from './quotas';
import { hermesJsonValueSchema, type HermesJobStatus, type HermesJobType } from './schemas';
import {
  hermesTransitionSourceStatuses,
  HermesService,
  type HermesJobRecord,
  type HermesJobStore,
  type ReserveHermesJobInput,
} from './service';

function storedType(value: string): HermesJobType {
  if (value === 'translate' || value === 'knowledge') return value;
  throw new Error('Stored Hermes job type is invalid.');
}

function storedStatus(value: string): HermesJobStatus {
  if (value === 'queued' || value === 'running' || value === 'succeeded' || value === 'failed') {
    return value;
  }
  throw new Error('Stored Hermes job status is invalid.');
}

function toJobRecord(job: HermesJob): HermesJobRecord {
  return {
    id: job.id,
    userId: job.userId,
    bridgeJobId: job.bridgeJobId,
    type: storedType(job.type),
    status: storedStatus(job.status),
    resultJson: job.resultJson === null ? null : hermesJsonValueSchema.parse(job.resultJson),
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

type QuotaCountRow = { count: number | bigint };

export class PrismaHermesJobStore implements HermesJobStore {
  constructor(private readonly db: PrismaClient = prisma) {}

  async consumeMinuteQuota(
    input: ConsumeHermesMinuteQuotaInput
  ): Promise<MinuteQuotaResult> {
    const consumed = await this.db.$queryRaw<QuotaCountRow[]>(Prisma.sql`
      INSERT INTO "HermesMinuteQuota" ("key", "windowStart", "count")
      VALUES (${input.key}, ${input.windowStart}, 1)
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "HermesMinuteQuota"."windowStart" = excluded."windowStart"
            THEN "HermesMinuteQuota"."count" + 1
          ELSE 1
        END,
        "windowStart" = excluded."windowStart"
      WHERE
        "HermesMinuteQuota"."windowStart" <> excluded."windowStart"
        OR "HermesMinuteQuota"."count" < ${input.limit}
      RETURNING "count"
    `);

    const row = consumed[0];
    if (!row) {
      return {
        ok: false,
        remaining: 0,
        retryAfterSeconds: input.retryAfterSeconds,
      };
    }

    const count = Number(row.count);
    if (!Number.isSafeInteger(count) || count < 1 || count > input.limit) {
      throw new Error('Stored Hermes minute quota is invalid.');
    }
    return {
      ok: true,
      remaining: input.limit - count,
      retryAfterSeconds: 0,
    };
  }

  async reserveJob(input: ReserveHermesJobInput): Promise<HermesJobRecord | null> {
    const job = await this.db.$transaction(async (tx) => {
      const dailyCount = await tx.hermesJob.count({
        where: {
          userId: input.userId,
          type: input.type,
          createdAt: { gte: input.dayStart, lt: input.dayEnd },
        },
      });
      if (dailyCount >= input.dailyLimit) return null;

      return tx.hermesJob.create({
        data: {
          id: input.id,
          userId: input.userId,
          type: input.type,
          status: input.status,
          createdAt: input.createdAt,
        },
      });
    });

    return job ? toJobRecord(job) : null;
  }

  async findOwnedJob(id: string, userId: string): Promise<HermesJobRecord | null> {
    const job = await this.db.hermesJob.findFirst({ where: { id, userId } });
    return job ? toJobRecord(job) : null;
  }

  async attachBridgeJob(
    id: string,
    bridgeJobId: string,
    status: HermesJobStatus
  ): Promise<HermesJobRecord> {
    await this.db.hermesJob.updateMany({
      where: { id, status: { in: hermesTransitionSourceStatuses(status) } },
      data: { bridgeJobId, status },
    });
    return this.requiredJob(id);
  }

  async transitionJob(
    id: string,
    data: {
      status: HermesJobStatus;
      resultJson: HermesJobRecord['resultJson'];
      error: string | null;
    }
  ): Promise<HermesJobRecord> {
    await this.db.hermesJob.updateMany({
      where: { id, status: { in: hermesTransitionSourceStatuses(data.status) } },
      data: {
        status: data.status,
        resultJson:
          data.resultJson === null
            ? Prisma.DbNull
            : (data.resultJson as Prisma.InputJsonValue),
        error: data.error,
      },
    });
    return this.requiredJob(id);
  }

  private async requiredJob(id: string): Promise<HermesJobRecord> {
    const job = await this.db.hermesJob.findUnique({ where: { id } });
    if (!job) throw new Error('Stored Hermes job is missing.');
    return toJobRecord(job);
  }
}

const store = new PrismaHermesJobStore();

export function getHermesService(): HermesService {
  const config = readHermesConfig();
  if (!config.enabled) {
    throw new HermesConfigError('Hermes is disabled.');
  }

  return new HermesService({
    store,
    client: new HermesClient(config),
  });
}
