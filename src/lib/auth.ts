import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ModuleCode, Profile } from "@/lib/types";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) redirect("/login");

  return { supabase, user, profile };
}

export async function requireAdmin() {
  const ctx = await requireUser();
  if (ctx.profile.role !== "admin") redirect("/vencimientos");
  return ctx;
}

/** Dueño de la plataforma: mantiene el calendario DIAN común y administra las ventas. */
export async function requirePlatformOwner() {
  const ctx = await requireUser();
  if (!ctx.profile.is_platform_owner) redirect("/vencimientos");
  return ctx;
}

/** ¿El despacho del usuario tiene vigente el módulo? (lo resuelve la función SQL has_module). */
export async function hasModule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  module: ModuleCode
): Promise<boolean> {
  const { data } = await supabase.rpc("has_module", { module });
  return data === true;
}
