import { requireAdmin } from "@/lib/auth";
import type { Company, Profile, UserCompanyAccess } from "@/lib/types";
import { UsersManager } from "./users-manager";

export default async function UsuariosPage() {
  const { supabase } = await requireAdmin();

  const [{ data: profiles }, { data: companies }, { data: access }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("companies").select("*").order("razon_social"),
    supabase.from("user_company_access").select("*"),
  ]);

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Usuarios</h1>
      <p className="mb-6 text-sm text-slate-500">
        Crea colaboradores y decide qué empresa(s) puede ver cada uno. Un colaborador nunca
        ve empresas que no le hayas asignado aquí.
      </p>
      <UsersManager
        profiles={(profiles ?? []) as Profile[]}
        companies={(companies ?? []) as Company[]}
        access={(access ?? []) as UserCompanyAccess[]}
      />
    </div>
  );
}
