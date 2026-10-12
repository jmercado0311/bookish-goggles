import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TRIAL_DAYS } from "@/lib/billing/modules";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST: registro público de un despacho nuevo con prueba gratis.
// Crea el despacho, invita al administrador por correo (el enlace verifica
// el correo y le pide crear su contraseña) y activa todos los módulos por
// TRIAL_DAYS días.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const fullName = String(body.full_name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const orgName = String(body.organization_name ?? "").trim();
  const nit = String(body.nit ?? "").trim() || null;

  if (!fullName || !orgName || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Completa nombre, despacho y un correo válido." }, { status: 400 });
  }
  if (body.acepta_terminos !== true) {
    return NextResponse.json(
      { error: "Debes aceptar los términos y la política de tratamiento de datos." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name: orgName, nit, contact_email: email })
    .select()
    .single();
  if (orgError) return NextResponse.json({ error: orgError.message }, { status: 500 });

  const redirectTo = `${new URL(request.url).origin}/actualizar-contrasena`;
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo,
  });

  if (inviteError || !invited.user) {
    await admin.from("organizations").delete().eq("id", org.id);
    const yaExiste = inviteError?.message?.toLowerCase().includes("already");
    return NextResponse.json(
      {
        error: yaExiste
          ? "Ese correo ya tiene una cuenta. Inicia sesión o recupera tu contraseña."
          : "No se pudo enviar el correo de activación. Intenta de nuevo.",
      },
      { status: yaExiste ? 409 : 400 }
    );
  }

  // El trigger crea el perfil como colaborador sin despacho; aquí el servidor
  // lo vuelve administrador de su despacho nuevo.
  const { error: profileError } = await admin
    .from("profiles")
    .update({ organization_id: org.id, role: "admin", full_name: fullName })
    .eq("id", invited.user.id);
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  const { data: modules } = await admin.from("service_modules").select("code").eq("active", true);
  const trialUntil = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await admin.from("organization_subscriptions").insert(
    (modules ?? []).map((m) => ({
      organization_id: org.id,
      module_code: m.code,
      active_until: trialUntil,
    }))
  );

  return NextResponse.json({ ok: true });
}
