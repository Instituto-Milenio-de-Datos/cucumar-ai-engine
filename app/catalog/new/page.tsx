import { prisma } from "@/lib/prisma";
import { SpeciesClassificationForm } from "./species-classification-form";

// Reads SeedSpecies directly via Prisma (no `fetch`) — see app/catalog/page.tsx.
export const dynamic = "force-dynamic";

export default async function NewConservationObjectPage() {
  const seedSpecies = await prisma.seedSpecies.findMany({
    orderBy: { commonName: "asc" },
    select: { commonName: true, scientificName: true },
  });

  const options = seedSpecies.map((species) => ({
    value: species.scientificName,
    label: species.commonName,
  }));

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Add species</h1>
        <p className="text-sm text-muted-foreground">
          Select a species from the seed list to classify it as a new conservation object.
        </p>
      </div>
      <SpeciesClassificationForm options={options} />
    </main>
  );
}
