-- CreateEnum
CREATE TYPE "CefrLevel" AS ENUM ('A2', 'B1', 'B2', 'C1');

-- AlterTable
ALTER TABLE "ListeningSet" ADD COLUMN     "level" "CefrLevel";
