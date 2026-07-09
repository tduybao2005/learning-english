-- AlterEnum
ALTER TYPE "GoalType" ADD VALUE 'TOEIC';

-- AlterTable
ALTER TABLE "PlacementAttempt" ADD COLUMN     "toeicListeningScore" INTEGER;

-- AlterTable
ALTER TABLE "PlacementTest" ADD COLUMN     "toeicListeningSetId" TEXT;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "imageUrl" TEXT;
