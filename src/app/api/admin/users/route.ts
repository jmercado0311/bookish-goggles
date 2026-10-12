import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// GET: lista los usuarios del despacho (para el panel de usuarios)
export async function GET() {
  const { profile } = await requireAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, role, created_at")
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data });
}

// POST: crea un colaborador nuevo del despacho (invitación por correo, sin auto-registro)
export async function POST(request: Request) {
  const { profile } = await requireAdmin();
  const admin = createAdminClient();
  const { email, full_name } = await request.json();

  if (!email || !full_name) {
    return NextResponse.json({ error: "Falta correo o nombre." }, { status: 400 });
  }
  if (!profile.organization_id) {
    return NextResponse.json({ error: "Tu usuario no pertenece a ningún despacho." }, { status: 400 });
  }

  const redirectTo = `${new URL(request.url).origin}/actualizar-contrasena`;

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name },
    redirectTo,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // El trigger crea el perfil sin despacho; se asigna al despacho de quien invita.
  const { error: profileError } = await admin
    .from("profiles")
    .update({ organization_id: profile.organization_id, role: "colaborador" })
    .eq("id", data.user.id);
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  return NextResponse.json({ user: data.user });
}

// DELETE: revoca el acceso de un colaborador del despacho (elimina el usuario de Auth)
export async function DELETE(request: Request) {
  const { profile } = await requireAdmin();
  const admin = createAdminClient();
  const { user_id } = await request.json();

  if (!user_id) {
    return NextResponse.json({ error: "Falta user_id." }, { status: 400 });
  }
  if (user_id === profile.id) {
    return NextResponse.json({ error: "No puedes eliminar tu propio usuario." }, { status: 400 });
  }

  const { data: target } = await admin
    .from("profiles")
    .select("organization_id")
    .eq("id", user_id)
    .maybeSingle();
  if (!target || target.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

  const { error } = await admin.auth.admin.deleteUser(user_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
