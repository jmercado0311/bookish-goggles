import Link from "next/link";
import { hasModule, requireUser } from "@/lib/auth";
import { canUseLedgerTools } from "@/lib/ledger/access";
import type { Company } from "@/lib/types";
import { Paywall } from "../paywall";
import { DeleteButton } from "./delete-button";

interface ImportRow {
  id: string;
  company_id: string;
  kind: "extracto" | "auxiliar";
  label: string;
  period_start: string | null;
  period_end: string | null;
  movement_count: number;
  method: string;
  created_at: string;
}

interface RecRow {
  id: string;
  company_id: string;
  cuenta_label: string;
  period_end: string;
  created_at: string;
}

export default async function ConciliacionesPage() {
  const { supabase, profile } = await requireUser();
  const isAdmin = profile.role === "admin";
  if (!(await canUseLedgerTools(supabase))) {
    return <Paywall moduleName="Conciliaciones y auxiliares" isAdmin={isAdmin} />;
  }
  const conciliacionesActivo = await hasModule(supabase, "conciliaciones");

  const [{ data: companies }, { data: imports }, { data: recs }] = await Promise.all([
    supabase.from("companies").select("*").order("razon_social"),
    supabase.from("ledger_imports").select("id, company_id, kind, label, period_start, period_end, movement_count, method, created_at").order("created_at", { ascending: false }),
    supabase.from("bank_reconciliations").select("id, company_id, cuenta_label, period_end, created_at").order("period_end", { ascending: false }),
  ]);
  const companyName = new Map(((companies ?? []) as Company[]).map((c) => [c.id, c.razon_social]));
  const fecha = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("es-CO") : "");
  const auxiliares = ((imports ?? []) as ImportRow[]).filter((i) => i.kind === "auxiliar");
  const extractos = ((imports ?? []) as ImportRow[]).filter((i) => i.kind === "extracto");

  const methodBadge = (m: string) =>
    m === "ia" ? <span className="ml-1 rounded-full bg-violet-100 px-1.5 text-[10px] text-violet-700">IA</span> : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Conciliaciones y auxiliares</h1>
          <p className="text-sm text-slate-500">
            Extractos de cualquier banco y auxiliares de cualquier sistema contable, conciliados automáticamente.
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            {conciliacionesActivo && (
              <Link href="/conciliaciones/nueva" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                + Nueva conciliación bancaria
              </Link>
            )}
            <Link href="/conciliaciones/importar?tipo=auxiliar" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Importar auxiliar
            </Link>
            <Link href="/conciliaciones/importar?tipo=extracto" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Importar extracto
            </Link>
          </div>
        )}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Conciliaciones bancarias</h2>
        {!conciliacionesActivo ? (
          <p className="text-sm text-slate-500">
            La conciliación bancaria es parte del módulo Conciliaciones y auxiliares.{" "}
            {isAdmin && <Link href="/facturacion" className="text-blue-600 hover:underline">Activarlo</Link>}
          </p>
        ) : (recs ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no hay conciliaciones.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <tbody>
                {((recs ?? []) as RecRow[]).map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 first:border-0">
                    <td className="px-4 py-2">
                      <Link href={`/conciliaciones/${r.id}`} className="font-medium text-blue-700 hover:underline">
                        {r.cuenta_label}
                      </Link>
                      <span className="block text-xs text-slate-500">{companyName.get(r.company_id)}</span>
                    </td>
                    <td className="px-4 py-2 text-slate-600">Corte {fecha(r.period_end)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {[
        { title: "Libros auxiliares", list: auxiliares, tipo: "auxiliar" },
        { title: "Extractos bancarios", list: extractos, tipo: "extracto" },
      ].map((s) => (
        <section key={s.tipo}>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">{s.title}</h2>
          {s.list.length === 0 ? (
            <p className="text-sm text-slate-500">Ninguno importado.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <tbody>
                  {s.list.map((i) => (
                    <tr key={i.id} className="border-t border-slate-100 first:border-0">
                      <td className="px-4 py-2">
                        {s.tipo === "auxiliar" ? (
                          <Link href={`/conciliaciones/auxiliar/${i.id}`} className="font-medium text-blue-700 hover:underline">
                            {i.label}
                          </Link>
                        ) : (
                          <span className="font-medium text-slate-900">{i.label}</span>
                        )}
                        {methodBadge(i.method)}
                        <span className="block text-xs text-slate-500">{companyName.get(i.company_id)}</span>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600">
                        {fecha(i.period_start)} a {fecha(i.period_end)} · {i.movement_count} movimientos
                      </td>
                      <td className="px-4 py-2 text-right">
                        {isAdmin && <DeleteButton url={`/api/ledger-imports/${i.id}`} confirmText={`¿Eliminar "${i.label}" y las conciliaciones que lo usan?`} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
