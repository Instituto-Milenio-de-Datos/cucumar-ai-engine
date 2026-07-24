import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";

const TAXONOMY_FIELDS = [
  { label: "Kingdom", key: "kingdom" },
  { label: "Phylum", key: "phylum" },
  { label: "Class", key: "class" },
  { label: "Order", key: "order" },
  { label: "Family", key: "family" },
  { label: "Genus", key: "genus" },
  { label: "Species", key: "species" },
] as const;

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

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-8">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        render={<Link href="/catalog" />}
        nativeButton={false}
      >
        <ArrowLeftIcon /> Back to catalog
      </Button>

      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{conservationObject.commonName}</h1>
        <Badge variant="secondary" className="w-fit">
          {conservationObject.analysisCategory}
        </Badge>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Taxonomy</h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 rounded-lg border p-4 sm:grid-cols-3">
          {TAXONOMY_FIELDS.map(({ label, key }) => (
            <div key={key} className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-sm font-medium">{conservationObject[key]}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Placeholders for later phases — not implemented yet. */}
      <section className="flex flex-col gap-3 rounded-lg border border-dashed p-6">
        <h2 className="text-sm font-medium text-muted-foreground">Evidence</h2>
        <p className="text-sm text-muted-foreground">
          The evidence table (Flow 2) will appear here in a later phase.
        </p>
      </section>

      <section className="flex flex-wrap gap-2 rounded-lg border border-dashed p-6">
        <Badge variant="outline">Search new evidence — coming soon</Badge>
        <Badge variant="outline">Download Excel — coming soon</Badge>
        <Badge variant="outline">Delete — coming soon</Badge>
      </section>
    </main>
  );
}
