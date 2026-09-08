import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// POST: asigna una empresa a un colaborador
export async function POST(request: Request) {
  const { user } = await requireAdmin();
  const admin = createAdminClient();
  const { user_id, company_id } = await request.json();

  if (!user_id || !company_id) {
    return NextResponse.json({ error: "Falta user_id o company_id." }, { status: 400 });
  }

  const { error } = await admin
    .from("user_company_access")
    .insert({ user_id, company_id, granted_by: user.id });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// DELETE: revoca el acceso de un colaborador a una empresa puntual
export async function DELETE(request: Request) {
  await requireAdmin();
  const admin = createAdminClient();
  const { user_id, company_id } = await request.json();

  if (!user_id || !company_id) {
    return NextResponse.json({ error: "Falta user_id o company_id." }, { status: 400 });
  }

  const { error } = await admin
    .from("user_company_access")
    .delete()
    .eq("user_id", user_id)
    .eq("company_id", company_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
