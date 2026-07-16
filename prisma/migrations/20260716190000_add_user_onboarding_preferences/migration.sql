-- AlterTable
-- Additive only: nullable columns, no defaults, no data rewrite, no drops.
-- Existing rows get NULL for every new column until a user completes the
-- conversational onboarding intake (Swarm J2/J3).
ALTER TABLE "User" ADD COLUMN "nativeLanguage" TEXT;
ALTER TABLE "User" ADD COLUMN "translationLanguage" TEXT;
ALTER TABLE "User" ADD COLUMN "travelRoute" TEXT;
ALTER TABLE "User" ADD COLUMN "preTravelTasks" TEXT;
ALTER TABLE "User" ADD COLUMN "helpPreference" TEXT;
ALTER TABLE "User" ADD COLUMN "voiceId" TEXT;
ALTER TABLE "User" ADD COLUMN "onboardingCompletedAt" DATETIME;
