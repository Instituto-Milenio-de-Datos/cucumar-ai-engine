"use client";

import { useState } from "react";
import { Loader2Icon, Trash2Icon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function DeleteConservationObjectButton({
  conservationObjectId,
  commonName,
  evidenceCount,
}: {
  conservationObjectId: string;
  commonName: string;
  evidenceCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirmDelete() {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/conservation-objects/${conservationObjectId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? `La solicitud falló con estado ${response.status}.`);
      }

      setOpen(false);
      // Deliberately a full navigation, not router.push(). Verified by testing
      // multiple client-side alternatives (push+refresh, revalidatePath (server)
      // + push, revalidatePath + push with prefetch disabled on the "Volver al
      // catálogo" link) — all still served a stale pre-delete Router Cache
      // snapshot of /catalog. Only a real navigation reliably shows fresh data.
      // The DELETE route still calls revalidatePath("/catalog") for other
      // paths that reach it (a fresh tab, a hard reload elsewhere).
      window.location.href = "/catalog";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
      setIsDeleting(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isDeleting) return;
        setOpen(nextOpen);
        if (nextOpen) setError(null);
      }}
    >
      <AlertDialogTrigger render={<Button variant="destructive" />}>
        <Trash2Icon /> Eliminar Objeto de Conservación
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar {commonName}?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer.{" "}
            {evidenceCount > 0
              ? `Se eliminarán también ${evidenceCount === 1 ? "la 1 evidencia recopilada" : `las ${evidenceCount} evidencias recopiladas`} para esta especie.`
              : "Todavía no hay evidencia recopilada para esta especie."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
            {isDeleting && <Loader2Icon className="animate-spin" />}
            {isDeleting ? "Eliminando..." : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
