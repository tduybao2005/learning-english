-- CreateEnum
CREATE TYPE "VocabTopicGroup" AS ENUM ('EVERYDAY', 'ACADEMIC', 'FUNCTIONAL');

-- AlterTable
ALTER TABLE "VocabWord" ADD COLUMN     "topicId" TEXT;

-- CreateTable
CREATE TABLE "VocabTopic" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameVi" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "group" "VocabTopicGroup" NOT NULL,
    "orderIndex" INTEGER NOT NULL,

    CONSTRAINT "VocabTopic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VocabTopic_slug_key" ON "VocabTopic"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "VocabTopic_group_orderIndex_key" ON "VocabTopic"("group", "orderIndex");

-- CreateIndex
CREATE INDEX "VocabWord_topicId_idx" ON "VocabWord"("topicId");

-- AddForeignKey
ALTER TABLE "VocabWord" ADD CONSTRAINT "VocabWord_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "VocabTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
