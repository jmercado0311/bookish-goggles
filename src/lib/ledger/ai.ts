import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ColumnMapping, FieldKey, SourceKind } from "./parse-movements";

/**
 * Respaldo con IA para extractos y auxiliares que las reglas no entienden.
 *
 * - Hojas de cálculo: se envían solo los encabezados y una muestra de filas;
 *   la IA devuelve el mapa de columnas y la lectura completa se hace en el
 *   navegador con ese mapa (el resto del archivo no sale de la plataforma).
 * - PDF: se envía el texto extraído del extracto y la IA devuelve los
 *   movimientos.
 */

const MODEL = "claude-opus-5-5";

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const FIELDS: FieldKey[] = [
  "fecha", "descripcion", "documento", "tercero", "nit", "cuenta", "cuenta_nombre",
  "debito", "credito", "valor", "tipo", "saldo",
];

const MappingSchema = z.object({
  header_row: z.number().int().describe("Índice (base 0) de la fila de encabezados; -1 si no hay encabezados"),
  columns: z.object(
    Object.fromEntries(FIELDS.map((f) => [f, z.number().int().nullable()])) as Record<FieldKey, z.ZodNullable<z.ZodNumber>>
  ),
  date_order: z.enum(["dmy", "mdy", "ymd"]),
  invert_valor: z.boolean().describe("true si, con columna valor, los retiros/débitos vienen positivos"),
  swap_debit_credit: z.boolean().describe("true si las columnas de débito y crédito están rotuladas al revés de su significado"),
  explicacion: z.string().describe("Una frase en español sobre la estructura detectada"),
});

const MovementsSchema = z.object({
  saldo_inicial: z.number().nullable(),
  saldo_final: z.number().nullable(),
  movimientos: z.array(
    z.object({
      fecha: z.string().describe("YYYY-MM-DD"),
      descripcion: z.string(),
      documento: z.string(),
      valor: z.number().describe("Positivo si entra dinero a la cuenta (abono/crédito del banco), negativo si sale (cargo/débito del banco)"),
      saldo: z.number().nullable(),
    })
  ),
});

async function logUsage(orgId: string | null, userId: string, purpose: string, usage: { input_tokens: number; output_tokens: number }) {
  await createAdminClient().from("ai_usage").insert({
    organization_id: orgId,
    user_id: userId,
    purpose,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
  });
}

class AiRefusal extends Error {}

async function ask<T>(schema: z.ZodType<T>, system: string, content: string, maxTokens: number): Promise<{ data: T; usage: { input_tokens: number; output_tokens: number } }> {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: maxTokens,
    // Si el modelo declina, el API reintenta con el modelo de respaldo que corresponda
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(schema) },
    system,
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal") throw new AiRefusal("La IA no procesó el archivo.");
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new Error("El archivo es demasiado extenso para leerlo de una vez; divídelo por periodos.");
  }
  return { data: response.parsed_output as T, usage: response.usage };
}

const cellText = (c: unknown) => (c === null || c === undefined ? "" : String(c).slice(0, 80));

export async function detectMappingWithAI(params: {
  kind: SourceKind;
  rows: unknown[][];
  orgId: string | null;
  userId: string;
}): Promise<{ mapping: ColumnMapping; explicacion: string }> {
  const sample = params.rows
    .slice(0, 45)
    .map((row, i) => `${i}\t${(row ?? []).slice(0, 25).map(cellText).join("\t")}`)
    .join("\n");

  const system =
    "Eres un contador colombiano experto en extractos bancarios y libros auxiliares de software contable. " +
    "Identificas la estructura de una tabla exportada. Las columnas se numeran desde 0. Usa null en campos que la tabla no tenga. " +
    "En un extracto bancario, 'débito' es retiro/cargo y 'crédito' es abono/consignación. En un libro auxiliar, débito y crédito son los contables. " +
    "Si hay una sola columna de valor con signo, mapea 'valor' y deja débito/crédito en null; si además hay una columna que dice D/C o Débito/Crédito, mapéala como 'tipo'.";

  const { data, usage } = await ask(
    MappingSchema,
    system,
    `Tipo de archivo: ${params.kind === "extracto" ? "extracto bancario" : "libro auxiliar contable"}.\nFilas (índice, celdas separadas por tabulador):\n${sample}`,
    2000
  );
  await logUsage(params.orgId, params.userId, `mapa_${params.kind}`, usage);

  const columns: ColumnMapping["columns"] = {};
  for (const f of FIELDS) {
    const v = data.columns[f];
    if (v !== null && v >= 0) columns[f] = v;
  }
  return {
    mapping: {
      headerRow: Math.max(-1, data.header_row),
      columns,
      dateOrder: data.date_order,
      invertValor: data.invert_valor,
      swapDebitCredit: data.swap_debit_credit,
    },
    explicacion: data.explicacion,
  };
}

const PDF_CHUNK = 30000;

export async function extractStatementWithAI(params: {
  text: string;
  year: number;
  orgId: string | null;
  userId: string;
}): Promise<z.infer<typeof MovementsSchema>> {
  const system =
    "Eres un contador colombiano. Extraes los movimientos de un extracto bancario a partir de su texto. " +
    "No inventes movimientos ni incluyas totales, saldos anteriores ni encabezados como movimientos. " +
    "valor es positivo si el dinero entra a la cuenta y negativo si sale; usa la columna de saldo para confirmar el signo. " +
    `Si una fecha no trae año, usa ${params.year}.`;

  // Extractos largos: por partes, conservando el orden
  const chunks: string[] = [];
  for (let i = 0; i < params.text.length; i += PDF_CHUNK) chunks.push(params.text.slice(i, i + PDF_CHUNK));
  if (chunks.length > 8) throw new Error("El extracto es demasiado extenso; súbelo por meses.");

  const result: z.infer<typeof MovementsSchema> = { saldo_inicial: null, saldo_final: null, movimientos: [] };
  for (const [i, chunk] of chunks.entries()) {
    const { data, usage } = await ask(
      MovementsSchema,
      system,
      `Parte ${i + 1} de ${chunks.length} del texto del extracto:\n\n${chunk}`,
      16000
    );
    await logUsage(params.orgId, params.userId, "pdf_extracto", usage);
    if (i === 0) result.saldo_inicial = data.saldo_inicial;
    if (data.saldo_final !== null) result.saldo_final = data.saldo_final;
    result.movimientos.push(...data.movimientos.filter((m) => /^\d{4}-\d{2}-\d{2}$/.test(m.fecha)));
  }
  return result;
}

export { AiRefusal };
