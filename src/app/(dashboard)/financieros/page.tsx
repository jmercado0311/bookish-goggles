import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { hasAnyFinancialModule } from "@/lib/financial/access";
import type { Company } from "@/lib/types";
import { Paywall } from "../paywall";

interface TrialBalanceRow {
  id: string;
  company_id: string;
  period_start: string;
  period_end: string;
  created_at: string;
}

export default async function FinancierosPage() {
  const { supabase, profile } = await requireUser();
  const isAdmin = profile.role === "admin";

  if (!(await hasAnyFinancialModule(supabase))) {
    return <Paywall moduleName="Estados financieros, notas e indicadores" isAdmin={isAdmin} />;
  }

  const [{ data: companies }, { data: balances }] = await Promise.all([
    supabase.from("companies").select("*").order("razon_social"),
    supabase.from("trial_balances").select("id, company_id, period_start, period_end, created_at").order("period_end", { ascending: false }),
  ]);

  const byCompany = new Map<string, TrialBalanceRow[]>();
  for (const tb of (balances ?? []) as TrialBalanceRow[]) {
    if (!byCompany.has(tb.company_id)) byCompany.set(tb.company_id, []);
    byCompany.get(tb.company_id)!.push(tb);
  }
  const list = ((companies ?? []) as Company[]).sort((a, b) =>
    a.razon_social.trim().localeCompare(b.razon_social.trim(), "es")
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Estados financieros</h1>
          <p className="text-sm text-slate-500">
            Sube el balance de prueba de cada empresa y obtén los estados financieros NIIF, sus notas
            y los indicadores financieros.
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/financieros/nuevo"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Importar balance de prueba
          </Link>
        )}
      </div>

      {list.length === 0 && (
        <p className="text-sm text-slate-500">Primero registra una empresa en la sección Empresas.</p>
      )}

      <div className="space-y-3">
        {list.map((c) => {
          const tbs = byCompany.get(c.id) ?? [];
          return (
            <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{c.razon_social}</p>
                <p className="text-xs text-slate-500">NIT {c.nit}{c.dv ? `-${c.dv}` : ""}</p>
              </div>
              {tbs.length === 0 ? (
                <p className="text-xs text-slate-400">Sin balances de prueba cargados.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tbs.map((tb) => (
                    <Link
                      key={tb.id}
                      href={`/financieros/${tb.id}`}
                      className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                    >
                      Corte {new Date(`${tb.period_end}T00:00:00`).toLocaleDateString("es-CO")}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
