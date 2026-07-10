-- AddForeignKey
ALTER TABLE "PlacementTest" ADD CONSTRAINT "PlacementTest_listeningSetId_fkey" FOREIGN KEY ("listeningSetId") REFERENCES "ListeningSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementTest" ADD CONSTRAINT "PlacementTest_toeicListeningSetId_fkey" FOREIGN KEY ("toeicListeningSetId") REFERENCES "ListeningSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
