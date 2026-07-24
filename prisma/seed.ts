import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../lib/prisma";

function parseSeedSpeciesCsv(csv: string) {
  const [, ...lines] = csv.trim().split("\n");
  return lines.map((line) => {
    const [commonName, scientificName] = line.split(",").map((s) => s.trim());
    return { commonName, scientificName };
  });
}

async function main() {
  const csvPath = join(process.cwd(), "docs/reference/seed-species.csv");
  const csv = readFileSync(csvPath, "utf-8");
  const species = parseSeedSpeciesCsv(csv);

  for (const { commonName, scientificName } of species) {
    await prisma.seedSpecies.upsert({
      where: { scientificName },
      update: { commonName },
      create: { commonName, scientificName },
    });
  }

  console.log(`Seeded ${species.length} species into SeedSpecies.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
