import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

// PUT: crea o actualiza el ICA de la empresa (opcional, no bloqueante)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase } = await requireAdmin();
  const { id: company_id } = await params;
  const { municipio, periodicidad, regla_dia_mes, fecha_puntual } = await request.json();

  if (!municipio) {
    return NextResponse.json({ error: "Falta el municipio." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("company_ica")
    .upsert(
      {
        company_id,
        municipio,
        periodicidad: periodicidad ?? "bimestral",
        regla_dia_mes: regla_dia_mes || null,
        fecha_puntual: fecha_puntual || null,
      },
      { onConflict: "company_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ica: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase } = await requireAdmin();
  const { id: company_id } = await params;

  const { error } = await supabase.from("company_ica").delete().eq("company_id", company_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
