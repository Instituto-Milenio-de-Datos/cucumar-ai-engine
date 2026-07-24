import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTaxonomy, TaxonomyResolutionError } from "@/lib/providers/taxonomy";

// Fixed for the whole MVP (see spec-original.md section 1-2). Kept as a named
// constant, not baked into the Prisma schema, so an admin UI can take over
// assigning it in a later phase without a migration.
const DEFAULT_ANALYSIS_CATEGORY = "Mamíferos marinos";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const scientificName =
    typeof (body as { scientificName?: unknown })?.scientificName === "string"
      ? (body as { scientificName: string }).scientificName.trim()
      : "";

  if (!scientificName) {
    return NextResponse.json({ error: "scientificName is required." }, { status: 400 });
  }

  const seedSpecies = await prisma.seedSpecies.findUnique({ where: { scientificName } });
  if (!seedSpecies) {
    return NextResponse.json(
      { error: `"${scientificName}" is not in the seed species list.` },
      { status: 404 },
    );
  }

  let taxonomy;
  try {
    taxonomy = await resolveTaxonomy(scientificName);
  } catch (error) {
    const message = error instanceof TaxonomyResolutionError ? error.message : "Taxonomy resolution failed.";
    console.error(
      JSON.stringify({ event: "classify_species.taxonomy_failed", scientificName, error: message }),
    );
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const conservationObject = await prisma.conservationObject.create({
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
