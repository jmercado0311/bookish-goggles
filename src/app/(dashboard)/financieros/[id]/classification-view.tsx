"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RUBROS, RUBRO_BY_KEY } from "@/lib/financial/puc-mapping";
import type { TBLine } from "@/lib/financial/statements";
import { money } from "./report-header";

const SECTION_LABEL: Record<string, string> = {
  activo_corriente: "Activo corriente",
  activo_no_corriente: "Activo no corriente",
  pasivo_corriente: "Pasivo corriente",
  pasivo_no_corriente: "Pasivo no corriente",
  patrimonio: "Patrimonio",
  resultados: "Resultados",
  excluido: "Excluidas",
};

export function ClassificationView({
  trialBalanceId,
  lines,
  canEdit,
}: {
  trialBalanceId: string;
  lines: TBLine[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      lines.filter((l) => {
        if (onlyIssues && RUBRO_BY_KEY.get(l.rubro)?.section !== "excluido") return false;
        const q = filter.toLowerCase();
        return !q || l.account_code.startsWith(q) || l.account_name.toLowerCase().includes(q);
      }),
    [lines, filter, onlyIssues]
  );

  async function reclassify(code: string, rubro: string) {
    setSaving(code);
    setError(null);
    const res = await fetch(`/api/financial/trial-balances/${trialBalanceId}/lines`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_code: code, rubro }),
    });
    setSaving(null);
    if (!res.ok) {
      setError("No se pudo reclasificar la cuenta.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Cada cuenta del balance se clasificó automáticamente en un rubro NIIF según el PUC. Ajusta lo
        que necesites, por ejemplo una obligación financiera de largo plazo o un activo no corriente.
        Las cuentas &quot;excluidas&quot; (orden, cierre, sin clasificar) no entran en los estados.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Buscar por código o nombre"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} />
          Solo excluidas / sin clasificar
        </label>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Cuenta</th>
              <th className="px-3 py-2 text-right">Saldo anterior</th>
              <th className="px-3 py-2 text-right">Saldo final</th>
              <th className="px-3 py-2">Rubro NIIF</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((l) => (
              <tr key={l.account_code} className="border-t border-slate-100">
                <td className="px-3 py-1.5 font-mono">{l.account_code}</td>
                <td className="px-3 py-1.5">{l.account_name}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{money(l.saldo_anterior)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{money(l.saldo_final)}</td>
                <td className="px-3 py-1.5">
                  {canEdit ? (
                    <select
                      value={l.rubro}
                      disabled={saving === l.account_code}
                      onChange={(e) => reclassify(l.account_code, e.target.value)}
                      className={`w-full rounded border px-1 py-1 ${
                        l.rubro === "sin_clasificar" ? "border-red-300 text-red-700" : "border-slate-200"
                      }`}
                    >
                      {Object.entries(SECTION_LABEL).map(([section, label]) => (
                        <optgroup key={section} label={label}>
                          {RUBROS.filter((r) => r.section === section).map((r) => (
                            <option key={r.key} value={r.key}>
                              {r.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  ) : (
                    RUBRO_BY_KEY.get(l.rubro)?.label
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
