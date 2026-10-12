import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadMovements } from "@/lib/ledger/load";
import { classifyUnmatched, summarize, type Match } from "@/lib/ledger/reconcile";
import { ReconciliationView } from "./reconciliation-view";

export default async function ConciliacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireUser();

  const { data: rec } = await supabase.from("bank_reconciliations").select("*").eq("id", id).maybeSingle();
  if (!rec) notFound();

  const [{ data: company }, bank, ledger] = await Promise.all([
    supabase.from("companies").select("razon_social, nit, dv").eq("id", rec.company_id).single(),
    loadMovements(supabase, rec.bank_import_id),
    loadMovements(supabase, rec.ledger_import_id, rec.cuenta_contable),
  ]);

  const matches = (rec.matches ?? []) as Match[];
  const items = classifyUnmatched(bank, ledger, matches, rec.period_end);
  const summary = summarize(items, Number(rec.saldo_extracto), Number(rec.saldo_libros));

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <Link href="/conciliaciones" className="text-xs text-blue-600 hover:underline">
          ← Conciliaciones
        </Link>
      </div>
      <ReconciliationView
        id={id}
        canEdit={profile.role === "admin"}
        header={{
          razonSocial: company?.razon_social ?? "",
          nit: company ? `${company.nit}${company.dv ? `-${company.dv}` : ""}` : "",
          cuenta: rec.cuenta_label,
          cuentaContable: rec.cuenta_contable,
          periodEnd: rec.period_end,
          tolerance: rec.tolerance_days,
          notes: rec.notes ?? "",
        }}
        bank={bank}
        ledger={ledger}
        matches={matches}
        items={items}
        summary={summary}
      />
    </div>
  );
}
