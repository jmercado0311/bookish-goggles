import { requireAdmin } from "@/lib/auth";
import { canUseLedgerTools } from "@/lib/ledger/access";
import type { Company } from "@/lib/types";
import { Paywall } from "../../paywall";
import { LedgerImporter } from "./ledger-importer";

export default async function ImportarPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; empresa?: string; volver?: string }>;
}) {
  const { supabase } = await requireAdmin();
  if (!(await canUseLedgerTools(supabase))) {
    return <Paywall moduleName="Conciliaciones y auxiliares" isAdmin />;
  }
  const { tipo, empresa, volver } = await searchParams;
  const kind = tipo === "auxiliar" ? "auxiliar" : "extracto";
  const { data: companies } = await supabase.from("companies").select("*").order("razon_social");

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">
        {kind === "extracto" ? "Importar extracto bancario" : "Importar libro auxiliar"}
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        Sube el archivo tal como lo descargas: Contaryx identifica la estructura, tú revisas la
        vista previa y confirmas.
      </p>
      <LedgerImporter
        companies={(companies ?? []) as Company[]}
        kind={kind}
        defaultCompanyId={empresa}
        returnTo={volver && volver.startsWith("/") ? volver : undefined}
      />
    </div>
  );
}
