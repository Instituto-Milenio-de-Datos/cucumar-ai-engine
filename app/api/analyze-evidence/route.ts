import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { searchEvidence, type EvidenceSearchResult } from "@/lib/providers/evidence";
import { classifyEvidence } from "@/lib/providers/llm";

// Simple retry, not a queue: 2 attempts with a short backoff per paper, then give
// up on classification and save the paper with metadata only (CLAUDE.md Flow 2).
const CLASSIFICATION_MAX_ATTEMPTS = 2;
const CLASSIFICATION_RETRY_DELAY_MS = 1000;

// Bounded concurrency, not unbounded Promise.all: cuts wall-clock time roughly
// proportionally (a full batch of 30 new papers went from ~3 minutes to under a
// minute) while staying comfortably under OpenAI rate limits. Chunks of this
// size run concurrently; one chunk fully finishes before the next starts.
const CLASSIFICATION_CONCURRENCY = 5;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "El cuerpo de la solicitud debe ser JSON válido." }, { status: 400 });
  }

  const conservationObjectId =
    typeof (body as { conservationObjectId?: unknown })?.conservationObjectId === "string"
      ? (body as { conservationObjectId: string }).conservationObjectId
      : "";

  if (!conservationObjectId) {
    return NextResponse.json({ error: "Debes indicar un conservationObjectId." }, { status: 400 });
  }

  // Atomic claim: a plain findUnique-then-update has a race window between the
  // read and the write where two concurrent requests can both see inAnalysis
  // false and both proceed. This conditional updateMany is a single UPDATE ...
  // WHERE statement, so Postgres itself serializes concurrent attempts — only
  // one can ever flip inAnalysis to true. This (not application code) is the
  // entire concurrency strategy (CLAUDE.md: "no distributed locks needed").
  const claimed = await prisma.conservationObject.updateMany({
    where: { id: conservationObjectId, inAnalysis: false },
    data: { inAnalysis: true },
  });

  if (claimed.count === 0) {
    const exists = await prisma.conservationObject.findUnique({ where: { id: conservationObjectId } });
    if (!exists) {
      return NextResponse.json({ error: "No se encontró el Objeto de Conservación." }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Ya hay un análisis de evidencia en curso para este Objeto de Conservación." },
      { status: 409 },
    );
  }

  const conservationObject = await prisma.conservationObject.findUniqueOrThrow({
    where: { id: conservationObjectId },
  });

  console.log(
    JSON.stringify({
      event: "analyze_evidence.started",
      conservationObjectId,
      scientificName: conservationObject.species,
    }),
  );

  const summary = {
    totalFound: 0,
    new: 0,
    classified: 0,
    savedWithoutClassification: 0,
  };

  async function processPaper(paper: EvidenceSearchResult) {
    try {
      // Unique per (conservationObject, paper), not globally — the same paper can
      // legitimately be evidence for more than one species (see prisma/schema.prisma).
      const existing = await prisma.evidence.findUnique({
        where: { conservationObjectId_openalexId: { conservationObjectId, openalexId: paper.openalexId } },
      });
      if (existing) {
        return;
      }

      summary.new += 1;

      const baseData = {
        openalexId: paper.openalexId,
        year: paper.year,
        authors: paper.authors,
        title: paper.title,
        keywords: paper.keywords,
        journal: paper.journal,
        abstractOriginalLanguage: paper.abstractOriginal,
        sourceUrl: paper.link,
        publicationType: paper.publicationType,
        isPubliclyAccessible: paper.isOpenAccess,
        conservationObjectId,
      };

      if (!paper.abstractOriginal) {
        await prisma.evidence.create({ data: baseData });
        summary.savedWithoutClassification += 1;
        console.log(
          JSON.stringify({
            event: "analyze_evidence.saved_no_abstract",
            conservationObjectId,
            openalexId: paper.openalexId,
          }),
        );
        return;
      }

      let classification: Awaited<ReturnType<typeof classifyEvidence>> | null = null;
      for (let attempt = 1; attempt <= CLASSIFICATION_MAX_ATTEMPTS; attempt++) {
        try {
          const result = await classifyEvidence(paper.abstractOriginal);
          if (!result.isUsableAbstract) {
            // Not a transient error — retrying won't change the model's judgment
            // that this text (a citation, a book's table of contents, etc.) isn't
            // a real abstract. Accept immediately, don't spread its other fields.
            console.log(
              JSON.stringify({
                event: "analyze_evidence.abstract_not_usable",
                conservationObjectId,
                openalexId: paper.openalexId,
              }),
            );
          } else {
            classification = result;
          }
          break;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(
            JSON.stringify({
              event: "analyze_evidence.classification_failed",
              conservationObjectId,
              openalexId: paper.openalexId,
              attempt,
              error: message,
            }),
          );
          if (attempt < CLASSIFICATION_MAX_ATTEMPTS) {
            await sleep(CLASSIFICATION_RETRY_DELAY_MS);
          }
        }
      }

      if (classification) {
        const { isUsableAbstract, ...classificationFields } = classification;
        void isUsableAbstract; // not an Evidence column; only used to gate the branch above
        await prisma.evidence.create({ data: { ...baseData, ...classificationFields } });
        summary.classified += 1;
        console.log(
          JSON.stringify({
            event: "analyze_evidence.classified",
            conservationObjectId,
            openalexId: paper.openalexId,
          }),
        );
      } else {
        // Either classification failed after retries, or the model determined
        // there was no usable abstract — keep the metadata we already have
        // rather than discarding the paper (CLAUDE.md Flow 2).
        await prisma.evidence.create({ data: baseData });
        summary.savedWithoutClassification += 1;
        console.log(
          JSON.stringify({
            event: "analyze_evidence.saved_without_classification",
            conservationObjectId,
            openalexId: paper.openalexId,
          }),
        );
      }
    } catch (error) {
      // A single paper's unexpected failure (e.g. a DB hiccup) must not take
      // down its batch-mates, nor abort the batches still to come.
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        JSON.stringify({
          event: "analyze_evidence.paper_failed",
          conservationObjectId,
          openalexId: paper.openalexId,
          error: message,
        }),
      );
    }
  }

  try {
    let papers;
    try {
      papers = await searchEvidence(conservationObject.species);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        JSON.stringify({ event: "analyze_evidence.search_failed", conservationObjectId, error: message }),
      );
      return NextResponse.json(
        { error: `No se pudo buscar evidencia en OpenAlex: ${message}` },
        { status: 502 },
      );
    }

    summary.totalFound = papers.length;

    // Bounded concurrency, not strictly one-at-a-time: each paper's
    // classification+save is still fully independent (never a multi-row,
    // all-or-nothing transaction), but failure isolation across papers is now
    // at the batch level rather than the single-paper level — see CLAUDE.md.
    for (const batch of chunk(papers, CLASSIFICATION_CONCURRENCY)) {
      await Promise.all(batch.map((paper) => processPaper(paper)));
    }

    return NextResponse.json(summary);
  } finally {
    await prisma.conservationObject.update({
      where: { id: conservationObjectId },
      data: { inAnalysis: false, lastAnalysisDate: new Date() },
    });
    console.log(JSON.stringify({ event: "analyze_evidence.finished", conservationObjectId, summary }));
  }
}
