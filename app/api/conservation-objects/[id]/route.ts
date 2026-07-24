import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Hard delete — onDelete: Cascade on Evidence.conservationObject (prisma/schema.prisma,
// Fase 1) removes its evidence automatically. No soft delete, no history kept (CLAUDE.md).
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const conservationObject = await prisma.conservationObject.findUnique({ where: { id } });
  if (!conservationObject) {
    return NextResponse.json({ error: "No se encontró el Objeto de Conservación." }, { status: 404 });
  }

  try {
    await prisma.conservationObject.delete({ where: { id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify({ event: "conservation_object.delete_failed", conservationObjectId: id, error: message }),
    );
    return NextResponse.json({ error: "No se pudo eliminar el Objeto de Conservación." }, { status: 500 });
  }

  // Route Handlers aren't Server Actions, but revalidatePath works from either
  // (Next.js docs). Without this, /catalog's own <Link prefetch> (the "Volver
  // al catálogo" button on the page we're deleting from) can have cached a
  // pre-delete snapshot client-side, which a plain router.push("/catalog")
  // would otherwise silently reuse.
  revalidatePath("/catalog");

  console.log(
    JSON.stringify({
      event: "conservation_object.deleted",
      conservationObjectId: id,
      commonName: conservationObject.commonName,
    }),
  );

  return NextResponse.json({ success: true });
}
