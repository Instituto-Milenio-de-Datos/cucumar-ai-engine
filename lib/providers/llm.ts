/**
 * Classifies a single piece of evidence (paper abstract) against the fixed
 * "Mamíferos marinos" criteria/subcriteria using one structured-output call to
 * OpenAI. Nothing outside this file should call OpenAI directly (see CLAUDE.md).
 *
 * Field names in CRITERIA and EvidenceClassification match prisma/schema.prisma's
 * Evidence model exactly, so callers can spread the result straight into a
 * `prisma.evidence.create({ data: { ... } })` call.
 */

import OpenAI from "openai";
import { CRITERIA, type CriteriaField } from "@/lib/criteria";

const DEFAULT_MODEL = "gpt-4o-mini";

export type EvidenceClassification = {
  /**
   * False when the text handed to classifyEvidence isn't actually a scientific
   * abstract (a bibliographic citation, a book's table of contents, etc. — see
   * the system prompt). The heuristic pre-filter in lib/providers/evidence.ts
   * only catches the obvious cases ("NA", "No abstract provided."); this field
   * is what catches the rest. Callers MUST ignore every other field below when
   * this is false and treat the paper as unclassified, same as a failed call.
   */
  isUsableAbstract: boolean;
  abstractSpanish: string;
  isAreaBasedEvidence: boolean;
  country: string | null;
  region: string | null;
  commune: string | null;
} & Record<CriteriaField, boolean>;

const SYSTEM_PROMPT = `Eres un asistente experto en conservación de fauna marina que ayuda a CuCuMar, una plataforma de planificación de áreas marinas protegidas en Chile.

Se te entrega un texto extraído del campo "abstract" de OpenAlex para un artículo sobre una especie de mamífero marino. Ese campo no siempre contiene un resumen científico real: a veces es una cita bibliográfica (solo autores/título/revista), el índice o la portada de un libro, u otro texto que no describe el contenido del artículo.

Primero decide "isUsableAbstract":
- false si el texto NO es un resumen científico real (es una cita, un índice, una tabla de contenidos, u otro texto sin contenido sustantivo sobre la investigación). En ese caso, igual completa el resto de los campos con los valores más neutros posibles ("abstractSpanish": "", el resto en false/null) — el llamador los va a ignorar por completo.
- true si el texto SÍ describe el contenido real del artículo (aunque sea breve). En ese caso completa todos los campos según las tareas siguientes.

Si "isUsableAbstract" es true, devuelve EXCLUSIVAMENTE lo que el resumen realmente respalda — no inventes ni asumas información que no esté en el texto:
1. "abstractSpanish": traduce/resume el resumen al español de forma fiel y completa (no lo acortes artificialmente).
2. "isAreaBasedEvidence": true si el resumen describe evidencia levantada en un área geográfica concreta (ej. un sitio, bahía, región específica), false si es evidencia general/no ligada a un lugar.
3. "country"/"region"/"commune": si el resumen menciona explícitamente dónde se levantó la evidencia, extrae país/región/comuna (usa la división administrativa de Chile cuando aplique). Si no se puede determinar con confianza, usa null — no adivines.
4. Para cada uno de los siguientes criterios y subcriterios de evaluación, responde true solo si el resumen aporta evidencia relacionada a ese criterio específico, false en caso contrario:

${CRITERIA.map(({ field, label }) => `- ${field}: ${label}`).join("\n")}`;

function buildJsonSchema() {
  const criteriaProperties = Object.fromEntries(
    CRITERIA.map(({ field }) => [field, { type: "boolean" }]),
  );

  return {
    name: "evidence_classification",
    strict: true,
    schema: {
      type: "object",
      properties: {
        isUsableAbstract: { type: "boolean" },
        abstractSpanish: { type: "string" },
        isAreaBasedEvidence: { type: "boolean" },
        country: { type: ["string", "null"] },
        region: { type: ["string", "null"] },
        commune: { type: ["string", "null"] },
        ...criteriaProperties,
      },
      required: [
        "isUsableAbstract",
        "abstractSpanish",
        "isAreaBasedEvidence",
        "country",
        "region",
        "commune",
        ...CRITERIA.map(({ field }) => field),
      ],
      additionalProperties: false,
    },
  };
}

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set.");
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

export async function classifyEvidence(abstract: string): Promise<EvidenceClassification> {
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  const response = await getClient().chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: abstract },
    ],
    response_format: { type: "json_schema", json_schema: buildJsonSchema() },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty classification response.");
  }

  return JSON.parse(content) as EvidenceClassification;
}
