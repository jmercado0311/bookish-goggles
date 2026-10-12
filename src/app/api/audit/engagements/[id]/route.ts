import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { trimStringFields } from "@/lib/trim-fields";

const TEXT = ["revisor_nombre", "revisor_tp", "firma_designante", "ciudad"] as const;
const NUMBERS = ["materialidad_porcentaje", "materialidad_global", "materialidad_ejecucion", "umbral_trivial"] as const;

// PATCH: materialidad, datos del revisor, fecha del informe y tipo de opinión
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  const b = trimStringFields(await request.json()) as Record<string, unknown>;
  const update: Record<string, unknown> = {};
  for (const k of TEXT) if (k in b) update[k] = b[k] ? String(b[k]).slice(0, 200) : null;
  for (const k of NUMBERS) if (k in b && Number.isFinite(Number(b[k]))) update[k] = Math.max(0, Number(b[k]));
  if ("materialidad_base" in b && ["activos", "ingresos", "utilidad", "patrimonio"].includes(String(b.materialidad_base))) update.materialidad_base = b.materialidad_base;
  if ("fecha_informe" in b) update.fecha_informe = /^\d{4}-\d{2}-\d{2}$/.test(String(b.fecha_informe)) ? b.fecha_informe : null;
  if ("opinion" in b && ["favorable", "con_salvedades", "desfavorable", "abstencion"].includes(String(b.opinion))) update.opinion = b.opinion;
  if ("generalizado" in b) update.generalizado = b.generalizado === true;

  const { error } = await supabase.from("audit_engagements").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  const { error } = await supabase.from("audit_engagements").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
