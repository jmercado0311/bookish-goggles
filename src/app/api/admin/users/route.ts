import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// GET: lista colaboradores (para el panel de usuarios)
export async function GET() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, role, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data });
}

// POST: crea un colaborador nuevo (invitación por correo, sin auto-registro)
export async function POST(request: Request) {
  await requireAdmin();
  const admin = createAdminClient();
  const { email, full_name } = await request.json();

  if (!email || !full_name) {
    return NextResponse.json({ error: "Falta correo o nombre." }, { status: 400 });
  }

  const redirectTo = `${new URL(request.url).origin}/actualizar-contrasena`;

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name, role: "colaborador" },
    redirectTo,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ user: data.user });
}

// DELETE: revoca el acceso de un colaborador (elimina el usuario de Auth)
export async function DELETE(request: Request) {
  await requireAdmin();
  const admin = createAdminClient();
  const { user_id } = await request.json();

  if (!user_id) {
    return NextResponse.json({ error: "Falta user_id." }, { status: 400 });
  }

  const { error } = await admin.auth.admin.deleteUser(user_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
