-- AlterTable
-- Additive only: existing users retain NULL until they choose a spoken language.
ALTER TABLE "User" ADD COLUMN "spokenLanguage" TEXT;
