"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  Loader2Icon,
  SearchIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CRITERIA, type CriteriaField } from "@/lib/criteria";

export type EvidenceRow = {
  id: string;
  title: string;
  year: number | null;
  authors: string | null;
  journal: string | null;
  publicationType: string;
  isPubliclyAccessible: boolean;
  abstractOriginalLanguage: string | null;
  abstractSpanish: string | null;
  country: string | null;
  region: string | null;
  sourceUrl: string | null;
} & Record<CriteriaField, boolean | null>;

interface AnalyzeEvidenceSummary {
  totalFound: number;
  new: number;
  classified: number;
  savedWithoutClassification: number;
}

const COLUMN_COUNT = 7;

export function EvidenceSection({
  conservationObjectId,
  evidence,
}: {
  conservationObjectId: string;
  evidence: EvidenceRow[];
}) {
  const router = useRouter();
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AnalyzeEvidenceSummary | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function handleSearch() {
    setIsSearching(true);
    setError(null);
    setSummary(null);

    try {
      const response = await fetch("/api/analyze-evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conservationObjectId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? `La solicitud falló con estado ${response.status}.`);
      }

      setSummary(data);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Evidencia</h2>
        <Button size="sm" onClick={handleSearch} disabled={isSearching}>
          {isSearching ? <Loader2Icon className="animate-spin" /> : <SearchIcon />}
          {isSearching ? "Buscando evidencia..." : "Buscar evidencia nueva"}
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {summary && (
        <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">
          {summary.totalFound} encontrados en OpenAlex, {summary.new} nuevos — {summary.classified}{" "}
          clasificados, {summary.savedWithoutClassification} guardados sin clasificar.
        </div>
      )}

      {evidence.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Todavía no hay evidencia para este Objeto de Conservación. Usa &quot;Buscar evidencia
          nueva&quot; para consultar OpenAlex.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-6" />
              <TableHead>Título</TableHead>
              <TableHead className="w-14">Año</TableHead>
              <TableHead>Autores</TableHead>
              <TableHead>Revista</TableHead>
              <TableHead className="w-28">Acceso público</TableHead>
              <TableHead>Resumen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {evidence.map((item) => {
              const isExpanded = expandedId === item.id;
              const isClassified = item.abstractSpanish !== null;
              const trueCriteria = CRITERIA.filter(({ field }) => item[field] === true);
              const location = [item.country, item.region].filter(Boolean).join(", ");

              return (
                <Fragment key={item.id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  >
                    <TableCell>
                      {isExpanded ? (
                        <ChevronDownIcon className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronRightIcon className="size-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate font-medium">{item.title}</TableCell>
                    <TableCell>{item.year ?? "—"}</TableCell>
                    <TableCell className="max-w-[140px] truncate text-muted-foreground">
                      {item.authors ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate text-muted-foreground">
                      {item.journal ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.isPubliclyAccessible ? "secondary" : "outline"}>
                        {item.isPubliclyAccessible ? "Sí" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[240px] whitespace-normal">
                      {isClassified ? (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {item.abstractSpanish}
                        </p>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>

                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={COLUMN_COUNT} className="whitespace-normal bg-muted/30">
                        <div className="flex flex-col gap-3 py-2">
                          <p className="text-sm font-medium">{item.title}</p>

                          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                            {item.authors && (
                              <div className="flex gap-1.5">
                                <dt className="font-medium">Autores:</dt>
                                <dd>{item.authors}</dd>
                              </div>
                            )}
                            {item.journal && (
                              <div className="flex gap-1.5">
                                <dt className="font-medium">Revista:</dt>
                                <dd>{item.journal}</dd>
                              </div>
                            )}
                            <div className="flex gap-1.5">
                              <dt className="font-medium">Tipo de publicación:</dt>
                              <dd>{item.publicationType}</dd>
                            </div>
                            {location && (
                              <div className="flex gap-1.5">
                                <dt className="font-medium">Ubicación:</dt>
                                <dd>{location}</dd>
                              </div>
                            )}
                          </dl>

                          {isClassified ? (
                            <p className="text-sm whitespace-pre-wrap">{item.abstractSpanish}</p>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">
                              {item.abstractOriginalLanguage
                                ? "Sin clasificar: la clasificación automática falló y se guardó solo la metadata disponible."
                                : "Sin clasificar: no se encontró abstract disponible."}
                            </p>
                          )}

                          {isClassified && (
                            <div className="flex flex-wrap gap-1.5">
                              {trueCriteria.length === 0 ? (
                                <span className="text-xs text-muted-foreground">
                                  No se marcó ningún criterio/subcriterio para este paper.
                                </span>
                              ) : (
                                trueCriteria.map(({ field, label }) => (
                                  <Badge key={field} variant="secondary">
                                    {label}
                                  </Badge>
                                ))
                              )}
                            </div>
                          )}

                          {item.sourceUrl && (
                            <a
                              href={item.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(event) => event.stopPropagation()}
                              className="inline-flex w-fit items-center gap-1 text-sm text-primary hover:underline"
                            >
                              Ver artículo <ExternalLinkIcon className="size-3.5" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
