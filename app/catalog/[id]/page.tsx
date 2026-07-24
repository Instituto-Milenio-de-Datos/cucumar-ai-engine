import { ArrowLeftIcon, DownloadIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { CRITERIA, type CriteriaField } from "@/lib/criteria";
import { DeleteConservationObjectButton } from "./delete-conservation-object-button";
import { EvidenceSection } from "./evidence-section";

// Reads directly via Prisma (no `fetch`) — see app/catalog/page.tsx.
export const dynamic = "force-dynamic";

const TAXONOMY_FIELDS = [
  { label: "Reino", key: "kingdom" },
  { label: "Filo", key: "phylum" },
  { label: "Clase", key: "class" },
  { label: "Orden", key: "order" },
  { label: "Familia", key: "family" },
  { label: "Género", key: "genus" },
  { label: "Especie", key: "species" },
] as const;

const CRITERIA_SELECT = Object.fromEntries(CRITERIA.map(({ field }) => [field, true])) as Record<
  CriteriaField,
  true
>;

export default async function ConservationObjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const conservationObject = await prisma.conservationObject.findUnique({ where: { id } });

  if (!conservationObject) {
    notFound();
  }

  const evidence = await prisma.evidence.findMany({
    where: { conservationObjectId: id },
    orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      year: true,
      authors: true,
      journal: true,
      publicationType: true,
      isPubliclyAccessible: true,
      abstractOriginalLanguage: true,
      abstractSpanish: true,
      country: true,
      region: true,
      sourceUrl: true,
      ...CRITERIA_SELECT,
    },
  });

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        render={<Link href="/catalog" />}
        nativeButton={false}
      >
        <ArrowLeftIcon /> Volver al catálogo
      </Button>

      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{conservationObject.commonName}</h1>
        <Badge variant="secondary" className="w-fit">
          {conservationObject.analysisCategory}
        </Badge>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Taxonomía</h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 rounded-lg border p-4 sm:grid-cols-3">
          {TAXONOMY_FIELDS.map(({ label, key }) => (
            <div key={key} className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-sm font-medium">{conservationObject[key]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <EvidenceSection conservationObjectId={id} evidence={evidence} />

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          render={<Link href={`/api/export-excel/${id}`} />}
          nativeButton={false}
        >
          <DownloadIcon /> Descargar Excel
        </Button>

        <DeleteConservationObjectButton
          conservationObjectId={id}
          commonName={conservationObject.commonName}
          evidenceCount={evidence.length}
        />
      </div>
    </>
  );
}
