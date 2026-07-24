-- CreateTable
CREATE TABLE "SeedSpecies" (
    "id" TEXT NOT NULL,
    "commonName" TEXT NOT NULL,
    "scientificName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeedSpecies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConservationObject" (
    "id" TEXT NOT NULL,
    "commonName" TEXT NOT NULL,
    "analysisCategory" TEXT NOT NULL,
    "kingdom" TEXT NOT NULL,
    "phylum" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "order" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "genus" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "inAnalysis" BOOLEAN NOT NULL DEFAULT false,
    "lastAnalysisDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConservationObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "openalexId" TEXT NOT NULL,
    "year" INTEGER,
    "authors" TEXT,
    "title" TEXT NOT NULL,
    "keywords" TEXT,
    "journal" TEXT,
    "abstractOriginalLanguage" TEXT,
    "abstractSpanish" TEXT,
    "sourceUrl" TEXT,
    "publicationType" TEXT NOT NULL,
    "country" TEXT,
    "region" TEXT,
    "commune" TEXT,
    "isAreaBasedEvidence" BOOLEAN NOT NULL,
    "isPubliclyAccessible" BOOLEAN NOT NULL,
    "contributesToImportantAreas" BOOLEAN NOT NULL,
    "contributesToDistributionAbundance" BOOLEAN NOT NULL,
    "contributesToSmallResidentPopulations" BOOLEAN NOT NULL,
    "contributesToAggregations" BOOLEAN NOT NULL,
    "contributesToKeyLifeCycleActivities" BOOLEAN NOT NULL,
    "contributesToBreedingAreas" BOOLEAN NOT NULL,
    "contributesToFeedingAreas" BOOLEAN NOT NULL,
    "contributesToMigratoryRoutes" BOOLEAN NOT NULL,
    "contributesToSpecialAttributes" BOOLEAN NOT NULL,
    "contributesToDistinctiveFeatures" BOOLEAN NOT NULL,
    "contributesToConnectivity" BOOLEAN NOT NULL,
    "contributesToThreatsGeneral" BOOLEAN NOT NULL,
    "contributesToClimateChangeThreat" BOOLEAN NOT NULL,
    "contributesToHabitatLossThreat" BOOLEAN NOT NULL,
    "contributesToInvasiveSpeciesThreat" BOOLEAN NOT NULL,
    "contributesToOverexploitationThreat" BOOLEAN NOT NULL,
    "contributesToPollutionThreat" BOOLEAN NOT NULL,
    "contributesToOtherThreats" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "conservationObjectId" TEXT NOT NULL,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeedSpecies_scientificName_key" ON "SeedSpecies"("scientificName");

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_openalexId_key" ON "Evidence"("openalexId");

-- CreateIndex
CREATE INDEX "Evidence_conservationObjectId_idx" ON "Evidence"("conservationObjectId");

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_conservationObjectId_fkey" FOREIGN KEY ("conservationObjectId") REFERENCES "ConservationObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
