-- CreateTable
CREATE TABLE "HermesJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bridgeJobId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "resultJson" JSONB,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HermesJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "HermesJob_bridgeJobId_key" ON "HermesJob"("bridgeJobId");

-- CreateIndex
CREATE INDEX "HermesJob_userId_type_createdAt_idx" ON "HermesJob"("userId", "type", "createdAt");

-- CreateTable
CREATE TABLE "HermesMinuteQuota" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "windowStart" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0
);
