"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Company, CompanyDeadline } from "@/lib/types";
import { deadlineKey } from "@/lib/types";
import { urgencyLevel, type UrgencyLevel } from "@/lib/tax-rules/urgency";
import { exportDeadlinesToExcel } from "@/lib/export/excel";

const URGENCY_STYLES: Record<UrgencyLevel, string> = {
  vencido: "bg-red-100 text-red-700 border-red-200",
  urgente: "bg-amber-100 text-amber-700 border-amber-200",
  proximo: "bg-blue-100 text-blue-700 border-blue-200",
  normal: "bg-slate-100 text-slate-600 border-slate-200",
};

const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  vencido: "Vencido",
  urgente: "Urgente",
  proximo: "Próximo",
  normal: "",
};

type EstadoFilter = "pendientes" | "vencidas" | "todas" | "presentadas";

export function DeadlinesView({
  deadlines,
  companies,
  canMarkPresentada,
}: {
  deadlines: CompanyDeadline[];
  companies: Company[];
  canMarkPresentada: boolean;
}) {
  const router = useRouter();
  const [companyFilter, setCompanyFilter] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>("pendientes");
  const [pending, setPending] = useState<Set<string>>(new Set());

  const sortedCompanies = useMemo(
    () => [...companies].sort((a, b) => a.razon_social.localeCompare(b.razon_social, "es")),
    [companies]
  );

  const byCompany = useMemo(
    () => (companyFilter ? deadlines.filter((d) => d.company.id === companyFilter) : deadlines),
    [deadlines, companyFilter]
  );

  const sinPresentar = useMemo(() => byCompany.filter((d) => !d.presentado), [byCompany]);
  const presentadas = useMemo(() => byCompany.filter((d) => d.presentado), [byCompany]);

  const vencidasCount = useMemo(
    () => sinPresentar.filter((d) => urgencyLevel(d.due_date) === "vencido").length,
    [sinPresentar]
  );

  const estadoTabs: { value: EstadoFilter; label: string; count?: number }[] = [
    { value: "pendientes", label: "Pendientes" },
    { value: "vencidas", label: "Vencidas", count: vencidasCount },
    { value: "todas", label: "Todas" },
    { value: "presentadas", label: "Presentadas", count: presentadas.length },
  ];

  const filtered = useMemo(() => {
    const base =
      estadoFilter === "presentadas"
        ? presentadas
        : estadoFilter === "todas"
          ? sinPresentar
          : sinPresentar.filter((d) => {
              const isVencido = urgencyLevel(d.due_date) === "vencido";
              return estadoFilter === "vencidas" ? isVencido : !isVencido;
            });

    // Siempre por fecha de vencimiento, sin agrupar por empresa — así se ve
    // de un vistazo qué es lo más próximo, sin importar de quién sea.
    return [...base].sort(
      (a, b) => a.due_date.localeCompare(b.due_date) || a.company.razon_social.localeCompare(b.company.razon_social)
    );
  }, [sinPresentar, presentadas, estadoFilter]);

  async function toggleEstado(d: CompanyDeadline) {
    const pregunta = d.presentado
      ? `¿Deshacer "presentada" de ${d.responsibility_name} (${d.company.razon_social}, ${d.period_label})? Volverá a aparecer en vencimientos.`
      : `¿Confirmas que ya se presentó ${d.responsibility_name} de ${d.company.razon_social} (${d.period_label})? Dejará de aparecer en vencimientos.`;

    if (!window.confirm(pregunta)) return;

    const key = deadlineKey(d);
    setPending((s) => new Set(s).add(key));

    const payload = {
      company_id: d.company.id,
      responsibility_code: d.responsibility_code,
      period_label: d.period_label,
      due_date: d.due_date,
    };

    await fetch("/api/declarations", {
      method: d.presentado ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setPending((s) => {
      const next = new Set(s);
      next.delete(key);
      return next;
    });
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Todas las empresas</option>
            {sortedCompanies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.razon_social}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap rounded-lg border border-slate-300 p-0.5 text-sm">
            {estadoTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setEstadoFilter(tab.value)}
                className={`rounded-md px-3 py-1.5 font-medium transition ${
                  estadoFilter === tab.value
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
                {tab.value === "vencidas" && !!tab.count && (
                  <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700">
                    {tab.count}
                  </span>
                )}
                {tab.value === "presentadas" && !!tab.count && (
                  <span className="ml-1.5 rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-semibold text-green-700">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => exportDeadlinesToExcel(filtered)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Exportar a Excel
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Exportar a PDF
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">NIT</th>
              <th className="px-4 py-3">Obligación</th>
              <th className="px-4 py-3">Periodo</th>
              <th className="px-4 py-3">Vence</th>
              <th className="px-4 py-3">Estado</th>
              {canMarkPresentada && <th className="px-4 py-3 print:hidden"></th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const level = urgencyLevel(d.due_date);
              const key = deadlineKey(d);
              const isPending = pending.has(key);
              return (
                <tr key={key} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {d.company.razon_social}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{d.company.nit}</td>
                  <td className="px-4 py-3">{d.responsibility_name}</td>
                  <td className="px-4 py-3 text-slate-500">{d.period_label}</td>
                  <td className="px-4 py-3">
                    {new Date(d.due_date + "T00:00:00").toLocaleDateString("es-CO")}
                  </td>
                  <td className="px-4 py-3">
                    {d.presentado ? (
                      <span className="rounded-full border border-green-200 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Presentada
                      </span>
                    ) : (
                      URGENCY_LABELS[level] && (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${URGENCY_STYLES[level]}`}
                        >
                          {URGENCY_LABELS[level]}
                        </span>
                      )
                    )}
                  </td>
                  {canMarkPresentada && (
                    <td className="px-4 py-3 text-right print:hidden">
                      <button
                        onClick={() => toggleEstado(d)}
                        disabled={isPending}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                          d.presentado
                            ? "border-slate-300 text-slate-600 hover:bg-slate-50"
                            : "border-green-300 text-green-700 hover:bg-green-50"
                        }`}
                      >
                        {isPending ? "..." : d.presentado ? "Deshacer" : "Marcar presentada"}
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-500">
            {byCompany.length === 0
              ? "No hay vencimientos para mostrar. Verifica que hayas cargado responsabilidades y el calendario DIAN del año."
              : estadoFilter === "vencidas"
                ? "¡Estás al día! No tienes nada vencido. 🎉"
                : estadoFilter === "presentadas"
                  ? "Todavía no has marcado ninguna declaración como presentada."
                  : "No tienes nada pendiente por ahora."}
          </p>
        )}
      </div>
    </div>
  );
}
