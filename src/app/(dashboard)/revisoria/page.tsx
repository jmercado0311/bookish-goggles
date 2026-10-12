import Link from "next/link";
import { hasModule, requireUser } from "@/lib/auth";
import { OPINION_LABEL, type Opinion } from "@/lib/audit/report";
import type { Company } from "@/lib/types";
import { Paywall } from "../paywall";

interface EngagementRow {
  id: string;
  company_id: string;
  period_end: string;
  opinion: Opinion;
  materialidad_global: number;
}

export default async function RevisoriaPage() {
  const { supabase, profile } = await requireUser();
  const isAdmin = profile.role === "admin";
  if (!(await hasModule(supabase, "revisoria"))) {
    return <Paywall moduleName="Revisoría fiscal" isAdmin={isAdmin} />;
  }
  const [{ data: companies }, { data: engagements }, { data: papers }] = await Promise.all([
    supabase.from("companies").select("*").order("razon_social"),
    supabase.from("audit_engagements").select("id, company_id, period_end, opinion, materialidad_global").order("period_end", { ascending: false }),
    supabase.from("audit_workpapers").select("engagement_id, estado"),
  ]);
  const name = new Map(((companies ?? []) as Company[]).map((c) => [c.id, c.razon_social]));
  const progress = (id: string) => {
    const list = (papers ?? []).filter((p) => p.engagement_id === id);
    return list.length ? Math.round((list.filter((p) => p.estado === "terminado").length / list.length) * 100) : 0;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Revisoría fiscal</h1>
          <p className="text-sm text-slate-500">
            Planeación, matriz de riesgos, papeles de trabajo, hallazgos y dictamen por empresa y periodo.
          </p>
        </div>
        {isAdmin && (
          <Link href="/revisoria/nuevo" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            + Nuevo encargo
          </Link>
        )}
      </div>
      {(engagements ?? []).length === 0 ? (
        <p className="text-sm text-slate-500">Todavía no hay encargos de revisoría.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {((engagements ?? []) as EngagementRow[]).map((e) => (
            <Link key={e.id} href={`/revisoria/${e.id}`} className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-blue-300">
              <p className="text-sm font-semibold text-slate-900">{name.get(e.company_id)}</p>
              <p className="text-xs text-slate-500">
                Cierre {new Date(`${e.period_end}T00:00:00`).toLocaleDateString("es-CO")} · Materialidad $
                {Math.round(Number(e.materialidad_global)).toLocaleString("es-CO")} · {OPINION_LABEL[e.opinion]}
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-slate-100">
                <div className="h-1.5 rounded-full bg-blue-600" style={{ width: `${progress(e.id)}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-500">{progress(e.id)} % de papeles de trabajo terminados</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
