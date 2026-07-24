/**
 * Resolves the full Linnaean taxonomy for a scientific name. GBIF is the primary
 * source; WoRMS (World Register of Marine Species) is used as a fallback for
 * names GBIF can't resolve. Nothing outside this file should call GBIF/WoRMS
 * directly (see CLAUDE.md).
 */

const REQUEST_TIMEOUT_MS = 10_000;

export interface ResolvedTaxonomy {
  kingdom: string;
  phylum: string;
  class: string;
  order: string;
  family: string;
  genus: string;
  species: string;
  source: "GBIF" | "WoRMS";
}

export class TaxonomyResolutionError extends Error {
  constructor(
    message: string,
    public readonly scientificName: string,
  ) {
    super(message);
    this.name = "TaxonomyResolutionError";
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`request to ${url} failed with status ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

interface GbifMatchResponse {
  matchType?: string;
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  genus?: string;
  species?: string;
}

function hasCompleteRanks(
  record: Partial<Record<"kingdom" | "phylum" | "class" | "order" | "family" | "genus" | "species", string | undefined>>,
): record is Record<"kingdom" | "phylum" | "class" | "order" | "family" | "genus" | "species", string> {
  return Boolean(
    record.kingdom &&
      record.phylum &&
      record.class &&
      record.order &&
      record.family &&
      record.genus &&
      record.species,
  );
}

async function matchGbif(scientificName: string): Promise<ResolvedTaxonomy | null> {
  const url = `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(scientificName)}`;
  const data = (await fetchJson(url)) as GbifMatchResponse;

  if (!data || data.matchType === "NONE" || !hasCompleteRanks(data)) {
    return null;
  }

  return {
    kingdom: data.kingdom,
    phylum: data.phylum,
    class: data.class,
    order: data.order,
    family: data.family,
    genus: data.genus,
    species: data.species,
    source: "GBIF",
  };
}

interface WormsAphiaRecord {
  status?: string;
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  genus?: string;
  valid_name?: string;
  scientificname?: string;
}

async function matchWorms(scientificName: string): Promise<ResolvedTaxonomy | null> {
  const url = `https://www.marinespecies.org/rest/AphiaRecordsByName/${encodeURIComponent(scientificName)}?like=false&marine_only=true`;

  let records: WormsAphiaRecord[] | null;
  try {
    records = (await fetchJson(url)) as WormsAphiaRecord[];
  } catch (error) {
    // WoRMS returns a bare HTTP 204 (empty body) when there is no match, which
    // fails JSON parsing rather than returning an empty array.
    if (error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }

  if (!Array.isArray(records) || records.length === 0) {
    return null;
  }

  const record = records.find((r) => r.status === "accepted") ?? records[0];

  if (
    !record.kingdom ||
    !record.phylum ||
    !record.class ||
    !record.order ||
    !record.family ||
    !record.genus
  ) {
    return null;
  }

  return {
    kingdom: record.kingdom,
    phylum: record.phylum,
    class: record.class,
    order: record.order,
    family: record.family,
    genus: record.genus,
    species: record.valid_name ?? record.scientificname ?? scientificName,
    source: "WoRMS",
  };
}

export async function resolveTaxonomy(scientificName: string): Promise<ResolvedTaxonomy> {
  const failures: string[] = [];

  try {
    const gbifResult = await matchGbif(scientificName);
    if (gbifResult) return gbifResult;
    failures.push("GBIF no encontró coincidencias");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ event: "taxonomy.gbif_error", scientificName, error: message }));
    failures.push(`la solicitud a GBIF falló (${message})`);
  }

  try {
    const wormsResult = await matchWorms(scientificName);
    if (wormsResult) return wormsResult;
    failures.push("WoRMS no encontró coincidencias");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ event: "taxonomy.worms_error", scientificName, error: message }));
    failures.push(`la solicitud a WoRMS falló (${message})`);
  }

  throw new TaxonomyResolutionError(
    `No se pudo resolver la taxonomía de "${scientificName}": ${failures.join("; ")}.`,
    scientificName,
  );
}
