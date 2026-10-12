import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadMovements } from "@/lib/ledger/load";
import { LedgerBrowser } from "./ledger-browser";

export default async function AuxiliarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data: imp } = await supabase.from("ledger_imports").select("*").eq("id", id).maybeSingle();
  if (!imp || imp.kind !== "auxiliar") notFound();
  const [{ data: company }, movements] = await Promise.all([
    supabase.from("companies").select("razon_social").eq("id", imp.company_id).single(),
    loadMovements(supabase, id),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/conciliaciones" className="text-xs text-blue-600 hover:underline">
          ← Conciliaciones y auxiliares
        </Link>
        <h1 className="text-lg font-semibold text-slate-900">{imp.label}</h1>
        <p className="text-sm text-slate-500">
          {company?.razon_social} · {imp.movement_count} movimientos · {imp.period_start} a {imp.period_end}
          {imp.source_file_name ? ` · ${imp.source_file_name}` : ""}
        </p>
      </div>
      <LedgerBrowser label={imp.label} movements={movements} />
    </div>
  );
}
