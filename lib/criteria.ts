/**
 * The fixed "Mamíferos marinos" ecological/threat criteria matrix. Field names
 * match prisma/schema.prisma's Evidence model exactly. Shared by lib/providers/llm.ts
 * (server-only) and the evidence UI (client) — kept in its own module, with no
 * server-only imports, so the client bundle never pulls in the OpenAI SDK.
 */

export const CRITERIA = [
  { field: "contributesToImportantAreas", label: "Área y/o Habitats de importancia para la especie" },
  { field: "contributesToDistributionAbundance", label: "Distribución, abundancia y avistamientos" },
  { field: "contributesToSmallResidentPopulations", label: "Poblaciones pequeñas y residentes" },
  { field: "contributesToAggregations", label: "Agregaciones" },
  { field: "contributesToKeyLifeCycleActivities", label: "Actividades clave en el ciclo de vida" },
  { field: "contributesToBreedingAreas", label: "Áreas de reproducción" },
  { field: "contributesToFeedingAreas", label: "Áreas de alimentación" },
  { field: "contributesToMigratoryRoutes", label: "Rutas migratorias y movimientos locales" },
  { field: "contributesToSpecialAttributes", label: "Atributos especiales" },
  { field: "contributesToDistinctiveFeatures", label: "Características distintivas" },
  { field: "contributesToConnectivity", label: "Conectividad" },
  { field: "contributesToThreatsGeneral", label: "Amenazas (general, sin especificar cuál)" },
  { field: "contributesToClimateChangeThreat", label: "Amenaza: cambio climático" },
  { field: "contributesToHabitatLossThreat", label: "Amenaza: pérdida y/o competencia por uso de hábitat" },
  { field: "contributesToInvasiveSpeciesThreat", label: "Amenaza: especies invasoras" },
  { field: "contributesToOverexploitationThreat", label: "Amenaza: sobrexplotación o captura incidental" },
  { field: "contributesToPollutionThreat", label: "Amenaza: contaminación" },
  { field: "contributesToOtherThreats", label: "Amenaza: otras" },
] as const;

export type CriteriaField = (typeof CRITERIA)[number]["field"];
