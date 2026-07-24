-- DropIndex
DROP INDEX "Evidence_conservationObjectId_idx";

-- DropIndex
DROP INDEX "Evidence_openalexId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_conservationObjectId_openalexId_key" ON "Evidence"("conservationObjectId", "openalexId");

