import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin } from "@/lib/auth";
import { canUseLedgerTools } from "@/lib/ledger/access";
import { aiConfigured, AiRefusal, detectMappingWithAI, extractStatementWithAI } from "@/lib/ledger/ai";

// POST: respaldo con IA cuando las reglas no entienden un extracto o auxiliar.
//  - { mode: "mapping", kind, rows }  -> mapa de columnas (solo encabezados y muestra)
//  - { mode: "pdf", text, year }       -> movimientos de un extracto en PDF
export async function POST(request: Request) {
  const { supabase, user, profile } = await requireAdmin();
  if (!(await canUseLedgerTools(supabase))) {
    return NextResponse.json({ error: "Tu plan no incluye conciliaciones ni revisoría fiscal." }, { status: 402 });
  }
  if (!aiConfigured()) {
    return NextResponse.json(
      { error: "La lectura con IA no está configurada. Ajusta las columnas manualmente." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  try {
    if (body.mode === "mapping") {
      if (!["extracto", "auxiliar"].includes(body.kind) || !Array.isArray(body.rows)) {
        return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
      }
      const result = await detectMappingWithAI({
        kind: body.kind,
        rows: (body.rows as unknown[][]).slice(0, 45),
        orgId: profile.organization_id,
        userId: user.id,
      });
      return NextResponse.json(result);
    }
    if (body.mode === "pdf") {
      const text = String(body.text ?? "");
      if (!text.trim()) return NextResponse.json({ error: "El PDF no tiene texto legible (¿es escaneado?)." }, { status: 400 });
      const result = await extractStatementWithAI({
        text: text.slice(0, 240000),
        year: Number(body.year) || new Date().getFullYear(),
        orgId: profile.organization_id,
        userId: user.id,
      });
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "Modo no válido." }, { status: 400 });
  } catch (err) {
    if (err instanceof AiRefusal) return NextResponse.json({ error: err.message }, { status: 422 });
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "La IA está ocupada; intenta en un minuto." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json({ error: "No se pudo consultar la IA." }, { status: 502 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error inesperado." }, { status: 500 });
  }
}
