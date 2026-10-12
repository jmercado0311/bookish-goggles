import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

// Usa el cliente del usuario (no la llave maestra): la política RLS de
// user_company_access exige que la empresa y el colaborador sean del mismo
// despacho del administrador.

// POST: asigna una empresa a un colaborador
export async function POST(request: Request) {
  const { supabase, user } = await requireAdmin();
  const { user_id, company_id } = await request.json();

  if (!user_id || !company_id) {
    return NextResponse.json({ error: "Falta user_id o company_id." }, { status: 400 });
  }

  const { error } = await supabase
    .from("user_company_access")
    .insert({ user_id, company_id, granted_by: user.id });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// DELETE: revoca el acceso de un colaborador a una empresa puntual
export async function DELETE(request: Request) {
  const { supabase } = await requireAdmin();
  const { user_id, company_id } = await request.json();

  if (!user_id || !company_id) {
    return NextResponse.json({ error: "Falta user_id o company_id." }, { status: 400 });
  }

  const { error } = await supabase
    .from("user_company_access")
    .delete()
    .eq("user_id", user_id)
    .eq("company_id", company_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
