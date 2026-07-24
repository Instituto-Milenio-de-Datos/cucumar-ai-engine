"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

interface SpeciesOption {
  value: string; // scientificName
  label: string; // commonName
}

export function SpeciesClassificationForm({ options }: { options: SpeciesOption[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<SpeciesOption | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!selected) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/classify-species", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scientificName: selected.value }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? `La solicitud falló con estado ${response.status}.`);
      }

      router.push(`/catalog/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="species-combobox" className="text-sm font-medium">
          Especie (nombre común)
        </label>
        <Combobox items={options} value={selected} onValueChange={setSelected}>
          <ComboboxInput id="species-combobox" placeholder="Ej: Chungungo" />
          <ComboboxContent>
            <ComboboxEmpty>No se encontraron especies.</ComboboxEmpty>
            <ComboboxList>
              {(item: SpeciesOption) => (
                <ComboboxItem key={item.value} value={item}>
                  <div className="flex flex-col">
                    <span>{item.label}</span>
                    <span className="text-xs text-muted-foreground italic">{item.value}</span>
                  </div>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <Button onClick={handleSubmit} disabled={!selected || isSubmitting}>
        {isSubmitting && <Loader2Icon className="animate-spin" />}
        {isSubmitting ? "Clasificando..." : "Clasificar especie"}
      </Button>
    </div>
  );
}
