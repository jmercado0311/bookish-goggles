import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

// ICA de la empresa: una fila por municipio donde declara (opcional, no bloqueante).

const PERIODICIDADES = ["mensual", "bimestral", "cuatrimestral", "semestral", "anual"];

function parseFields(body: Record<string, unknown>) {
  const periodicidad = String(body.periodicidad ?? "bimestral");
  if (!PERIODICIDADES.includes(periodicidad)) return null;
  const dia = Number(body.regla_dia_mes);
  return {
    periodicidad,
    regla_dia_mes: Number.isInteger(dia) && dia >= 1 && dia <= 31 ? dia : null,
    fecha_puntual: typeof body.fecha_puntual === "string" && body.fecha_puntual ? body.fecha_puntual : null,
  };
}

// POST: agrega un municipio de ICA a la empresa
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdmin();
  const { id: company_id } = await params;
  const body = await request.json();
  const municipio = String(body.municipio ?? "").trim();
  const fields = parseFields(body);

  if (!municipio || !fields) {
    return NextResponse.json({ error: "Falta el municipio o la periodicidad no es válida." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("company_ica")
    .insert({ company_id, municipio, ...fields })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: `La empresa ya tiene ICA en ${municipio}.` }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ica: data });
}

// PUT: cambia la periodicidad o la regla de respaldo de un municipio ya registrado
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdmin();
  const { id: company_id } = await params;
  const body = await request.json();
  const fields = parseFields(body);

  if (!body.ica_id || !fields) {
    return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("company_ica")
    .update(fields)
    .eq("id", body.ica_id)
    .eq("company_id", company_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ica: data });
}

// DELETE: quita un municipio de ICA de la empresa
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdmin();
  const { id: company_id } = await params;
  const { ica_id } = await request.json().catch(() => ({}));

  if (!ica_id) return NextResponse.json({ error: "Falta el municipio a quitar." }, { status: 400 });

  const { error } = await supabase.from("company_ica").delete().eq("id", ica_id).eq("company_id", company_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
