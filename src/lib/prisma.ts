import { PrismaClient } from '@/generated/prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url) return url;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'DATABASE_URL is not set. The app refuses to fall back to a local SQLite file in production — configure DATABASE_URL in the environment.'
    );
  }
  // Local development fallback only
  return 'file:prisma/dev.db';
}

function createPrismaClient() {
  const adapter = new PrismaLibSql({
    url: resolveDatabaseUrl(),
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  });
  return new PrismaClient({ adapter });
}

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

/**
 * Lazy proxy: the client (and the DATABASE_URL check) is only created on
 * first actual use. This keeps `next build` free of any database
 * requirement — page-data collection imports route modules without
 * running queries.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrismaClient(), prop, receiver);
  },
});
