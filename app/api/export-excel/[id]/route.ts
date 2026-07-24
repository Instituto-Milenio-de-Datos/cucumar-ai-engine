import { NextRequest, NextResponse } from "next/server";
import { generateExcel } from "@/lib/export/excel";

const COMBINING_DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

function buildFilename(commonName: string): string {
  const normalized = commonName
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "") // NFD decomposes é -> e + combining mark; drop the mark
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "");
  return `Evidencia_${normalized || "especie"}.xlsx`;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let result;
  try {
    result = await generateExcel(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ event: "export_excel.failed", conservationObjectId: id, error: message }));
    return NextResponse.json({ error: "No se pudo generar el archivo Excel." }, { status: 500 });
  }

  if (!result) {
    return NextResponse.json({ error: "No se encontró el Objeto de Conservación." }, { status: 404 });
  }

  console.log(JSON.stringify({ event: "export_excel.generated", conservationObjectId: id }));

  const filename = buildFilename(result.commonName);

  return new NextResponse(result.buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
