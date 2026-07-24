import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";

// Reads ConservationObject directly via Prisma (no `fetch`), so Next has no
// signal this depends on mutable data — without this it gets prerendered once
// at build time and serves a stale snapshot in production.
export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" });

export default async function CatalogPage() {
  const conservationObjects = await prisma.conservationObject.findMany({
    orderBy: { commonName: "asc" },
    select: {
      id: true,
      commonName: true,
      species: true,
      analysisCategory: true,
      lastAnalysisDate: true,
    },
  });

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Catalog</h1>
          <p className="text-sm text-muted-foreground">
            Conservation objects classified so far.
          </p>
        </div>
        <Button render={<Link href="/catalog/new" />} nativeButton={false}>
          Add species
        </Button>
      </div>

      {conservationObjects.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed p-16 text-center">
          <p className="text-sm text-muted-foreground">
            No conservation objects have been classified yet.
          </p>
          <Button render={<Link href="/catalog/new" />} nativeButton={false}>
            Add species
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Common name</TableHead>
              <TableHead>Scientific name</TableHead>
              <TableHead>Analysis category</TableHead>
              <TableHead>Last analysis date</TableHead>
              <TableHead className="text-right">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conservationObjects.map((conservationObject) => (
              <TableRow key={conservationObject.id}>
                <TableCell className="font-medium">{conservationObject.commonName}</TableCell>
                <TableCell className="italic text-muted-foreground">
                  {conservationObject.species}
                </TableCell>
                <TableCell>{conservationObject.analysisCategory}</TableCell>
                <TableCell>
                  {conservationObject.lastAnalysisDate
                    ? dateFormatter.format(conservationObject.lastAnalysisDate)
                    : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/catalog/${conservationObject.id}`} />}
                    nativeButton={false}
                  >
                    Details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
