import Link from "next/link";
import { requireUser } from "@/lib/auth";
import type { Company } from "@/lib/types";

export default async function EmpresasPage() {
  const { supabase, profile } = await requireUser();
  const isAdmin = profile.role === "admin";

  const { data: companies } = await supabase
    .from("companies")
    .select("*")
    .order("razon_social");

  const list = (companies ?? []) as Company[];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Empresas</h1>
          <p className="text-sm text-slate-500">
            {isAdmin ? "Tu cartera de empresas." : "Empresas que tienes asignadas."}
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/empresas/nueva"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Nueva empresa
          </Link>
        )}
      </div>

      {list.length === 0 && (
        <p className="text-sm text-slate-500">
          {isAdmin
            ? "Aún no has registrado ninguna empresa."
            : "Tu contador todavía no te ha asignado ninguna empresa."}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((c) => (
          <Link
            key={c.id}
            href={`/empresas/${c.id}`}
            className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-sm"
          >
            <p className="text-sm font-semibold text-slate-900">{c.razon_social}</p>
            {c.nombre_comercial && (
              <p className="text-xs text-slate-500">{c.nombre_comercial}</p>
            )}
            <p className="mt-2 text-xs text-slate-600">
              NIT {c.nit}
              {c.dv ? `-${c.dv}` : ""}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {c.tipo_contribuyente} · {c.regimen ?? "sin régimen"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
