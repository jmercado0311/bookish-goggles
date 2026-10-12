import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requirePlatformOwner } from "@/lib/auth";
import { aiConfigured } from "@/lib/ledger/ai";
import { runSalesAssistant, type ChatTurn } from "@/lib/sales/assistant";
import { mergeTurns } from "@/lib/sales/handle-message";
import type { ServiceModule } from "@/lib/types";

// POST: conversación de prueba con el asistente de ventas (no envía nada ni guarda prospectos)
export async function POST(request: Request) {
  const { supabase } = await requirePlatformOwner();
  if (!aiConfigured()) {
    return NextResponse.json({ error: "Falta ANTHROPIC_API_KEY en las variables de entorno." }, { status: 503 });
  }
  const body = await request.json().catch(() => ({}));
  const history = (Array.isArray(body.history) ? body.history : [])
    .filter((t: ChatTurn) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string" && t.content.trim())
    .map((t: ChatTurn) => ({ role: t.role, content: t.content.slice(0, 4000) }));
  const turns = mergeTurns(history);
  if (!turns.length || turns[turns.length - 1].role !== "user") {
    return NextResponse.json({ error: "Escribe un mensaje." }, { status: 400 });
  }
  const { data: modules } = await supabase.from("service_modules").select("*").eq("active", true).order("sort_order");
  try {
    const result = await runSalesAssistant({
      history: turns,
      modules: (modules ?? []) as ServiceModule[],
      appUrl: process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin,
      contactId: null,
      persist: false,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Anthropic.APIError) return NextResponse.json({ error: "No se pudo consultar la IA." }, { status: 502 });
    throw err;
  }
}
