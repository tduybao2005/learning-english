-- AlterTable
ALTER TABLE "IeltsTest" ADD COLUMN     "bandTable" JSONB,
ADD COLUMN     "readingKeyVerified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Section" ADD COLUMN     "ieltsTestId" TEXT;

-- CreateTable
CREATE TABLE "IeltsAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ieltsTestId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "rawScore" INTEGER,
    "band" DOUBLE PRECISION,

    CONSTRAINT "IeltsAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IeltsAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerText" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "matchType" "MatchType",

    CONSTRAINT "IeltsAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IeltsAttempt_userId_ieltsTestId_idx" ON "IeltsAttempt"("userId", "ieltsTestId");

-- CreateIndex
CREATE UNIQUE INDEX "IeltsAnswer_attemptId_questionId_key" ON "IeltsAnswer"("attemptId", "questionId");

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_ieltsTestId_fkey" FOREIGN KEY ("ieltsTestId") REFERENCES "IeltsTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IeltsAttempt" ADD CONSTRAINT "IeltsAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IeltsAttempt" ADD CONSTRAINT "IeltsAttempt_ieltsTestId_fkey" FOREIGN KEY ("ieltsTestId") REFERENCES "IeltsTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IeltsAnswer" ADD CONSTRAINT "IeltsAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "IeltsAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IeltsAnswer" ADD CONSTRAINT "IeltsAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
