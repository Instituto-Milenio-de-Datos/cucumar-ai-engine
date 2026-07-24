/**
 * Searches OpenAlex for papers related to a species. Nothing outside this file
 * should call OpenAlex directly (see CLAUDE.md).
 */

const REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_SEARCH_LIMIT = 30;

export interface EvidenceSearchResult {
  openalexId: string;
  year: number | null;
  authors: string | null;
  title: string;
  keywords: string | null;
  journal: string | null;
  abstractOriginal: string | null;
  link: string | null;
  publicationType: string;
  isOpenAccess: boolean;
}

interface OpenAlexWork {
  id: string;
  doi?: string | null;
  title?: string | null;
  publication_year?: number | null;
  authorships?: { author?: { display_name?: string | null } | null }[];
  keywords?: { display_name?: string | null }[];
  primary_location?: {
    source?: { display_name?: string | null } | null;
    landing_page_url?: string | null;
  } | null;
  open_access?: { is_oa?: boolean | null } | null;
  type?: string | null;
  abstract_inverted_index?: Record<string, number[]> | null;
}

interface OpenAlexWorksResponse {
  results: OpenAlexWork[];
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

// OpenAlex (particularly records ingested via Plazi/the Biodiversity Heritage
// Library) sometimes populates abstract_inverted_index with placeholder text
// instead of leaving it empty — "NA", "No abstract provided.", etc. These are
// cheap/obvious to catch before ever calling the LLM. Non-obvious junk (a bare
// citation string, a book's table of contents) isn't caught here — that's the
// LLM's job via EvidenceClassification.isUsableAbstract in lib/providers/llm.ts.
const PLACEHOLDER_ABSTRACT_MIN_LENGTH = 30;
const PLACEHOLDER_ABSTRACT_PATTERNS = [/no abstract/i, /^n\/?a\.?$/i, /^none\.?$/i];

function isPlaceholderAbstract(text: string): boolean {
  if (text.length < PLACEHOLDER_ABSTRACT_MIN_LENGTH) return true;
  return PLACEHOLDER_ABSTRACT_PATTERNS.some((pattern) => pattern.test(text));
}

/** OpenAlex stores abstracts as a word -> [positions] inverted index; rebuild the plain text. */
function reconstructAbstract(invertedIndex: Record<string, number[]> | null | undefined): string | null {
  if (!invertedIndex) return null;

  const wordsByPosition: string[] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const position of positions) {
      wordsByPosition[position] = word;
    }
  }

  const text = wordsByPosition.filter(Boolean).join(" ").trim();
  if (!text || isPlaceholderAbstract(text)) return null;
  return text;
}

function getSearchLimit(): number {
  const raw = process.env.EVIDENCE_SEARCH_LIMIT;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SEARCH_LIMIT;
}

export async function searchEvidence(scientificName: string): Promise<EvidenceSearchResult[]> {
  const limit = getSearchLimit();

  const url = new URL("https://api.openalex.org/works");
  url.searchParams.set("search", scientificName);
  url.searchParams.set("per-page", String(limit));
  url.searchParams.set(
    "select",
    "id,doi,title,publication_year,authorships,keywords,primary_location,open_access,type,abstract_inverted_index",
  );
  if (process.env.OPENALEX_API_KEY) {
    url.searchParams.set("api_key", process.env.OPENALEX_API_KEY);
  }

  const data = (await fetchJson(url.toString())) as OpenAlexWorksResponse;

  return data.results
    .filter((work) => work.id && work.title)
    .map((work) => {
      const authors =
        work.authorships
          ?.map((authorship) => authorship.author?.display_name)
          .filter((name): name is string => Boolean(name))
          .join(", ") || null;

      const keywords =
        work.keywords
          ?.map((keyword) => keyword.display_name)
          .filter((name): name is string => Boolean(name))
          .join(", ") || null;

      return {
        openalexId: work.id.replace("https://openalex.org/", ""),
        year: work.publication_year ?? null,
        authors,
        title: work.title as string,
        keywords,
        journal: work.primary_location?.source?.display_name ?? null,
        abstractOriginal: reconstructAbstract(work.abstract_inverted_index),
        link: work.primary_location?.landing_page_url ?? work.doi ?? work.id,
        publicationType: work.type ?? "unknown",
        isOpenAccess: work.open_access?.is_oa ?? false,
      };
    });
}
