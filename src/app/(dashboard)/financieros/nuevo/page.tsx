import { requireAdmin } from "@/lib/auth";
import { hasAnyFinancialModule } from "@/lib/financial/access";
import type { Company } from "@/lib/types";
import { Paywall } from "../../paywall";
import { ImportWizard } from "./import-wizard";

export default async function NuevoBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const { empresa } = await searchParams;

  if (!(await hasAnyFinancialModule(supabase))) {
    return <Paywall moduleName="Estados financieros, notas e indicadores" isAdmin />;
  }

  const { data: companies } = await supabase.from("companies").select("*").order("razon_social");

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Importar balance de prueba</h1>
      <p className="mb-6 text-sm text-slate-500">
        Exporta el balance de prueba de tu software contable (Siigo, World Office, Alegra, Helisa,
        ContaPyme…) a Excel (.xlsx) o CSV, con columnas de código, nombre, saldo anterior, débitos,
        créditos y saldo final. Revisa la vista previa antes de guardar.
      </p>
      <ImportWizard
        companies={((companies ?? []) as Company[]).sort((a, b) =>
          a.razon_social.trim().localeCompare(b.razon_social.trim(), "es")
        )}
        defaultCompanyId={empresa}
      />
    </div>
  );
}
