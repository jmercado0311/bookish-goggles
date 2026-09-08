import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase } = await requireAdmin();
  const { id: company_id } = await params;
  const { tipo, nombre, regla_dia_mes, fecha_puntual } = await request.json();

  if (!tipo || !nombre || (!regla_dia_mes && !fecha_puntual)) {
    return NextResponse.json(
      { error: "Falta tipo, nombre, y una regla de día o una fecha puntual." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("custom_obligations")
    .insert({
      company_id,
      tipo,
      nombre,
      regla_dia_mes: regla_dia_mes || null,
      fecha_puntual: fecha_puntual || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ obligation: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase } = await requireAdmin();
  const { id: company_id } = await params;
  const { obligation_id } = await request.json();

  const { error } = await supabase
    .from("custom_obligations")
    .delete()
    .eq("company_id", company_id)
    .eq("id", obligation_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
