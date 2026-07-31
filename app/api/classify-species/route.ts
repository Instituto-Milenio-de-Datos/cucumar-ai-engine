import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { resolveTaxonomy, TaxonomyResolutionError } from "@/lib/providers/taxonomy";

const DUPLICATE_SPECIES_ERROR = "Esta especie ya fue clasificada.";

// Fixed for the whole MVP (see spec-original.md section 1-2). Kept as a named
// constant, not baked into the Prisma schema, so an admin UI can take over
// assigning it in a later phase without a migration.
const DEFAULT_ANALYSIS_CATEGORY = "Mamíferos marinos";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "El cuerpo de la solicitud debe ser JSON válido." }, { status: 400 });
  }

  const scientificName =
    typeof (body as { scientificName?: unknown })?.scientificName === "string"
      ? (body as { scientificName: string }).scientificName.trim()
      : "";

  if (!scientificName) {
    return NextResponse.json({ error: "Debes indicar un nombre científico (scientificName)." }, { status: 400 });
  }

  const seedSpecies = await prisma.seedSpecies.findUnique({ where: { scientificName } });
  if (!seedSpecies) {
    return NextResponse.json(
      { error: `"${scientificName}" no corresponde a ninguna especie de la lista.` },
      { status: 404 },
    );
  }

  const existing = await prisma.conservationObject.findUnique({
    where: { species: scientificName },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: DUPLICATE_SPECIES_ERROR, existingId: existing.id },
      { status: 409 },
    );
  }

  let taxonomy;
  try {
    taxonomy = await resolveTaxonomy(scientificName);
  } catch (error) {
    const message =
      error instanceof TaxonomyResolutionError ? error.message : "No se pudo resolver la taxonomía.";
    console.error(
      JSON.stringify({ event: "classify_species.taxonomy_failed", scientificName, error: message }),
    );
    return NextResponse.json({ error: message }, { status: 502 });
  }

  let conservationObject;
  try {
    conservationObject = await prisma.conservationObject.create({
      data: {
        commonName: seedSpecies.commonName,
        analysisCategory: DEFAULT_ANALYSIS_CATEGORY,
        kingdom: taxonomy.kingdom,
        phylum: taxonomy.phylum,
        class: taxonomy.class,
        order: taxonomy.order,
        family: taxonomy.family,
        genus: taxonomy.genus,
        species: taxonomy.species,
      },
    });
  } catch (error) {
    // Race guard: two concurrent requests can both pass the findUnique check above
    // before either commits. The DB unique constraint is the actual guarantee; this
    // just turns its violation into the same clean response as the pre-check.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raceExisting = await prisma.conservationObject.findUnique({
        where: { species: taxonomy.species },
        select: { id: true },
      });
      return NextResponse.json(
        { error: DUPLICATE_SPECIES_ERROR, existingId: raceExisting?.id },
        { status: 409 },
      );
    }
    throw error;
  }

  console.log(
    JSON.stringify({
      event: "classify_species.created",
      conservationObjectId: conservationObject.id,
      scientificName,
      taxonomySource: taxonomy.source,
    }),
  );

  return NextResponse.json({ id: conservationObject.id }, { status: 201 });
}
