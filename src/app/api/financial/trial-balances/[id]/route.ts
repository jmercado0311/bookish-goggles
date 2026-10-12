import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { trimStringFields } from "@/lib/trim-fields";

const EDITABLE = [
  "framework",
  "representante_legal",
  "contador_nombre",
  "contador_tp",
  "revisor_fiscal_nombre",
  "revisor_fiscal_tp",
] as const;

// PATCH: marco técnico y firmas de los estados financieros
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  const body = trimStringFields(await request.json()) as Record<string, unknown>;

  const update: Record<string, unknown> = {};
  for (const key of EDITABLE) {
    if (key in body) update[key] = body[key] === "" ? null : body[key];
  }
  if ("framework" in update && !["grupo1", "grupo2", "grupo3"].includes(String(update.framework))) {
    return NextResponse.json({ error: "Marco técnico no válido." }, { status: 400 });
  }

  const { error } = await supabase.from("trial_balances").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdmin();
  const { id } = await params;

  const { error } = await supabase.from("trial_balances").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
