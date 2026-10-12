import { hasModule, requireAdmin } from "@/lib/auth";
import type { Company } from "@/lib/types";
import { Paywall } from "../../paywall";
import { NewEngagementForm } from "./new-engagement-form";

export default async function NuevoEncargoPage() {
  const { supabase, profile } = await requireAdmin();
  if (!(await hasModule(supabase, "revisoria"))) return <Paywall moduleName="Revisoría fiscal" isAdmin />;
  const [{ data: companies }, { data: tbs }] = await Promise.all([
    supabase.from("companies").select("*").order("razon_social"),
    supabase.from("trial_balances").select("id, company_id, period_start, period_end").order("period_end", { ascending: false }),
  ]);
  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Nuevo encargo de revisoría fiscal</h1>
      <p className="mb-6 text-sm text-slate-500">
        Con el balance de prueba de la empresa, Contaryx calcula la materialidad (NIA 320), propone la
        matriz de riesgos y los papeles de trabajo según los saldos significativos.
      </p>
      <NewEngagementForm
        companies={(companies ?? []) as Company[]}
        trialBalances={(tbs ?? []) as { id: string; company_id: string; period_start: string; period_end: string }[]}
        defaultRevisor={profile.full_name}
      />
    </div>
  );
}
