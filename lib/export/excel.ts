/**
 * Generates the "1_Tabla_BD" Excel export for a single ConservationObject.
 * Column order, sheet name, and header text must match
 * docs/reference/1_Tabla_DB.xlsx exactly (checked directly, not inferred from
 * the Prisma schema comments — see CLAUDE.md's Excel export section).
 */

import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import type { CriteriaField } from "@/lib/criteria";

const SHEET_NAME = "Hoja1";
const LOE_HEADER_COMMENT = "No evaluado en este MVP";

// Cols Z-AJ (ecological dimension) then AK-AQ (threats dimension) — exact
// header text from the reference file's row 4, including its typos/spacing.
const CRITERIA_COLUMNS: { field: CriteriaField; header: string }[] = [
  { field: "contributesToImportantAreas", header: "A-Área y/o Habitats de importancia para la especie" },
  { field: "contributesToDistributionAbundance", header: "B_Distribución, abundancia y avistamientos" },
  { field: "contributesToSmallResidentPopulations", header: "B1_Poblaciones pequeñas y residentes" },
  { field: "contributesToAggregations", header: "B2_Agregaciones" },
  { field: "contributesToKeyLifeCycleActivities", header: "C-Actividades Clave en el Ciclo de Vida " },
  { field: "contributesToBreedingAreas", header: "C1-Áreas de reproducción" },
  { field: "contributesToFeedingAreas", header: "C2-Áreas de Alimentación" },
  { field: "contributesToMigratoryRoutes", header: "C3-Rutas Migratorias y Movimientos " },
  { field: "contributesToSpecialAttributes", header: "D-Atributos Especiales" },
  { field: "contributesToDistinctiveFeatures", header: "D1-Distinciones" },
  { field: "contributesToConnectivity", header: "D3-Conectividad" },
  { field: "contributesToThreatsGeneral", header: "Amenazas gal" },
  { field: "contributesToClimateChangeThreat", header: "Cambio Climático" },
  { field: "contributesToHabitatLossThreat", header: "Pérdida y/o competencia por uso  de hábitat" },
  { field: "contributesToInvasiveSpeciesThreat", header: "Especies Invasoras" },
  { field: "contributesToOverexploitationThreat", header: "Sobrexplotación o captira incidental" },
  { field: "contributesToPollutionThreat", header: "Contaminación" },
  { field: "contributesToOtherThreats", header: "Otros" },
];

function siNo(value: boolean | null): string | undefined {
  if (value === null) return undefined;
  return value ? "Sí" : "No";
}

export interface GeneratedExcel {
  buffer: ExcelJS.Buffer;
  commonName: string;
}

export async function generateExcel(conservationObjectId: string): Promise<GeneratedExcel | null> {
  const conservationObject = await prisma.conservationObject.findUnique({
    where: { id: conservationObjectId },
    include: { evidence: { orderBy: [{ year: "desc" }, { createdAt: "desc" }] } },
  });

  if (!conservationObject) return null;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(SHEET_NAME);

  sheet.columns = [
    { header: "ID", key: "id", width: 6 },
    { header: "OC", key: "oc", width: 22 },
    { header: "Grupo de Análisis", key: "analysisCategory", width: 20 },
    { header: "Reino", key: "kingdom", width: 12 },
    { header: "filo", key: "phylum", width: 12 },
    { header: "Clase", key: "class", width: 12 },
    { header: "Orden", key: "order", width: 14 },
    { header: "Familia", key: "family", width: 16 },
    { header: "Genero", key: "genus", width: 16 },
    { header: "Especie", key: "species", width: 22 },
    { header: "Año", key: "year", width: 8 },
    { header: "Autor@s", key: "authors", width: 30 },
    { header: "Título", key: "title", width: 40 },
    { header: "Palabras clave", key: "keywords", width: 25 },
    { header: "Revista", key: "journal", width: 25 },
    { header: "Resumen idioma original", key: "abstractOriginalLanguage", width: 50 },
    { header: "Resuen en español", key: "abstractSpanish", width: 50 },
    { header: "Enlace", key: "sourceUrl", width: 30 },
    { header: "Tipo de Publicación", key: "publicationType", width: 18 },
    { header: "Robustez toma de decisiones", key: "loe", width: 22 },
    { header: "País", key: "country", width: 14 },
    { header: "Región ", key: "region", width: 14 },
    { header: "Comuna", key: "commune", width: 14 },
    { header: "Evidencia basada en área (si/no)", key: "isAreaBasedEvidence", width: 18 },
    { header: "Acceso Público", key: "isPubliclyAccessible", width: 14 },
    ...CRITERIA_COLUMNS.map(({ field, header }) => ({ header, key: field, width: 16 })),
  ];

  const loeColumnNumber = sheet.getColumn("loe").number;
  sheet.getRow(1).getCell(loeColumnNumber).note = LOE_HEADER_COMMENT;

  conservationObject.evidence.forEach((evidence, index) => {
    const row: Record<string, unknown> = {
      id: index + 1,
      oc: conservationObject.commonName,
      analysisCategory: conservationObject.analysisCategory,
      kingdom: conservationObject.kingdom,
      phylum: conservationObject.phylum,
      class: conservationObject.class,
      order: conservationObject.order,
      family: conservationObject.family,
      genus: conservationObject.genus,
      species: conservationObject.species,
      year: evidence.year ?? undefined,
      authors: evidence.authors ?? undefined,
      title: evidence.title,
      keywords: evidence.keywords ?? undefined,
      journal: evidence.journal ?? undefined,
      abstractOriginalLanguage: evidence.abstractOriginalLanguage ?? undefined,
      abstractSpanish: evidence.abstractSpanish ?? undefined,
      sourceUrl: evidence.sourceUrl ?? undefined,
      publicationType: evidence.publicationType,
      // loe: intentionally left blank on every row (CLAUDE.md).
      country: evidence.country ?? undefined,
      region: evidence.region ?? undefined,
      commune: evidence.commune ?? undefined,
      isAreaBasedEvidence: siNo(evidence.isAreaBasedEvidence),
      isPubliclyAccessible: siNo(evidence.isPubliclyAccessible),
    };

    for (const { field } of CRITERIA_COLUMNS) {
      row[field] = evidence[field] ? 1 : 0;
    }

    sheet.addRow(row);
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return { buffer, commonName: conservationObject.commonName };
}
