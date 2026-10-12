import { hasModule, requireAdmin } from "@/lib/auth";
import type { Company } from "@/lib/types";
import { Paywall } from "../../paywall";
import { NewReconciliationForm, type ImportOption } from "./new-reconciliation-form";

export default async function NuevaConciliacionPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; extracto?: string; auxiliar?: string }>;
}) {
  const { supabase } = await requireAdmin();
  if (!(await hasModule(supabase, "conciliaciones"))) {
    return <Paywall moduleName="Conciliaciones y auxiliares" isAdmin />;
  }
  const params = await searchParams;
  const [{ data: companies }, { data: imports }] = await Promise.all([
    supabase.from("companies").select("*").order("razon_social"),
    supabase
      .from("ledger_imports")
      .select("id, company_id, kind, label, period_start, period_end, saldo_final, movement_count")
      .order("created_at", { ascending: false }),
  ]);

  // Si viene de importar un archivo, la empresa sale de ese archivo
  const justImported = (imports ?? []).find((i) => i.id === params.extracto || i.id === params.auxiliar);

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Nueva conciliación bancaria</h1>
      <p className="mb-6 text-sm text-slate-500">
        Elige el extracto del banco y el auxiliar de la cuenta de bancos. Contaryx empareja las
        partidas y clasifica las conciliatorias; luego puedes ajustar a mano.
      </p>
      <NewReconciliationForm
        companies={(companies ?? []) as Company[]}
        imports={(imports ?? []) as ImportOption[]}
        initial={{
          companyId: params.empresa ?? justImported?.company_id ?? "",
          extractoId: params.extracto ?? "",
          auxiliarId: params.auxiliar ?? "",
        }}
      />
    </div>
  );
}
