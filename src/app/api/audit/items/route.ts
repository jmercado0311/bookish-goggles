import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

// CRUD de riesgos, papeles de trabajo y hallazgos de un encargo.
// Body: { table, engagement_id, id?, data? }. Solo se aceptan los campos permitidos de cada tabla.

const LEVEL = ["alto", "medio", "bajo"];
const TABLES = {
  risks: {
    name: "audit_risks",
    fields: {
      area: "text", afirmacion: "text", descripcion: "text", respuesta: "text",
      riesgo_inherente: LEVEL, riesgo_control: LEVEL, significativo: "bool", sort: "int",
    },
  },
  workpapers: {
    name: "audit_workpapers",
    fields: {
      ref: "text", area: "text", titulo: "text", objetivo: "text", procedimientos: "text", resultado: "text",
      conclusion: "text", estado: ["pendiente", "en_proceso", "terminado"], preparado_por: "text", revisado_por: "text",
      fecha_preparacion: "date", fecha_revision: "date", sort: "int",
    },
  },
  findings: {
    name: "audit_findings",
    fields: {
      workpaper_ref: "text", titulo: "text", condicion: "text", criterio: "text", causa: "text", efecto: "text",
      recomendacion: "text", monto: "num", tipo: ["incorreccion", "control_interno", "incumplimiento_legal", "otro"], corregido: "bool",
    },
  },
} as const;

type TableKey = keyof typeof TABLES;

function clean(table: TableKey, data: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [field, kind] of Object.entries(TABLES[table].fields)) {
    if (!(field in data)) continue;
    const v = data[field];
    if (Array.isArray(kind)) {
      if ((kind as readonly string[]).includes(String(v))) out[field] = v;
    } else if (kind === "text") out[field] = String(v ?? "").slice(0, 10000);
    else if (kind === "bool") out[field] = v === true;
    else if (kind === "int") out[field] = Math.trunc(Number(v) || 0);
    else if (kind === "num") out[field] = Number.isFinite(Number(v)) ? Number(v) : 0;
    else if (kind === "date") out[field] = /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? v : null;
  }
  return out;
}

async function parse(request: Request) {
  const b = await request.json().catch(() => ({}));
  if (!(b.table in TABLES)) return null;
  return b as { table: TableKey; engagement_id?: string; id?: string; data?: Record<string, unknown> };
}

export async function POST(request: Request) {
  const { supabase } = await requireAdmin();
  const b = await parse(request);
  if (!b || !b.engagement_id) return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
  const row = clean(b.table, b.data ?? {});
  if (b.table === "workpapers" && (!row.ref || !row.titulo)) return NextResponse.json({ error: "Falta la referencia o el título." }, { status: 400 });
  if (b.table === "findings" && !row.titulo) return NextResponse.json({ error: "Falta el título del hallazgo." }, { status: 400 });
  if (b.table === "risks" && (!row.area || !row.descripcion)) return NextResponse.json({ error: "Falta el área o la descripción." }, { status: 400 });
  if (b.table === "risks" && !row.afirmacion) row.afirmacion = "Todas";
  if (b.table === "workpapers" && !row.area) row.area = row.titulo;
  const { data, error } = await supabase.from(TABLES[b.table].name).insert({ ...row, engagement_id: b.engagement_id }).select().single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Ya existe un papel con esa referencia." : error.message }, { status: 400 });
  return NextResponse.json({ item: data });
}

export async function PATCH(request: Request) {
  const { supabase } = await requireAdmin();
  const b = await parse(request);
  if (!b || !b.id) return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
  const { error } = await supabase.from(TABLES[b.table].name).update(clean(b.table, b.data ?? {})).eq("id", b.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { supabase } = await requireAdmin();
  const b = await parse(request);
  if (!b || !b.id) return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
  const { error } = await supabase.from(TABLES[b.table].name).delete().eq("id", b.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
