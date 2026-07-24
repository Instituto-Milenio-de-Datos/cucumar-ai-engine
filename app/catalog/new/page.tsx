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
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Agregar especie</h1>
        <p className="text-sm text-muted-foreground">
          Selecciona una especie de la lista para clasificarla como un nuevo Objeto de Conservación.
        </p>
      </div>
      <SpeciesClassificationForm options={options} />
    </div>
  );
}
