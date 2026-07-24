import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { searchEvidence } from "@/lib/providers/evidence";
import { classifyEvidence } from "@/lib/providers/llm";

// Simple retry, not a queue: 2 attempts with a short backoff per paper, then give
// up on classification and save the paper with metadata only (CLAUDE.md Flow 2).
const CLASSIFICATION_MAX_ATTEMPTS = 2;
const CLASSIFICATION_RETRY_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

    // Sequential on purpose (CLAUDE.md): each paper is classified and saved
    // immediately, never batched — if paper 15 of 30 fails, 1-14 stay saved.
    for (const paper of papers) {
      // Unique per (conservationObject, paper), not globally — the same paper can
      // legitimately be evidence for more than one species (see prisma/schema.prisma).
      const existing = await prisma.evidence.findUnique({
        where: { conservationObjectId_openalexId: { conservationObjectId, openalexId: paper.openalexId } },
      });
      if (existing) {
        continue;
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
        continue;
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
