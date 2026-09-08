"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CompanyIca } from "@/lib/types";

export function IcaEditor({
  companyId,
  ica,
  readOnly,
}: {
  companyId: string;
  ica: CompanyIca | null;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [municipio, setMunicipio] = useState(ica?.municipio ?? "");
  const [periodicidad, setPeriodicidad] = useState(ica?.periodicidad ?? "bimestral");
  const [modo, setModo] = useState<"regla" | "fecha">(
    ica?.fecha_puntual ? "fecha" : "regla"
  );
  const [reglaDiaMes, setReglaDiaMes] = useState(String(ica?.regla_dia_mes ?? "15"));
  const [fechaPuntual, setFechaPuntual] = useState(ica?.fecha_puntual ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/companies/${companyId}/ica`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        municipio,
        periodicidad,
        regla_dia_mes: modo === "regla" ? Number(reglaDiaMes) : null,
        fecha_puntual: modo === "fecha" ? fechaPuntual : null,
      }),
    });
    setSaving(false);
    router.refresh();
  }

  async function handleRemove() {
    setSaving(true);
    await fetch(`/api/companies/${companyId}/ica`, { method: "DELETE" });
    setMunicipio("");
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">ICA (opcional)</h2>
      <p className="mb-4 text-xs text-slate-500">
        Es municipal y opcional: si no lo defines, el resto de la ficha de la empresa
        funciona con normalidad.
      </p>

      {readOnly ? (
        ica ? (
          <p className="text-sm text-slate-700">
            {ica.municipio} · {ica.periodicidad} ·{" "}
            {ica.regla_dia_mes ? `día ${ica.regla_dia_mes} de cada mes` : ica.fecha_puntual}
          </p>
        ) : (
          <p className="text-sm text-slate-500">No definido.</p>
        )
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Municipio
              </label>
              <input
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Fonseca"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Periodicidad
              </label>
              <select
                value={periodicidad}
                onChange={(e) => setPeriodicidad(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="bimestral">Bimestral</option>
                <option value="anual">Anual</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={modo === "regla"}
                onChange={() => setModo("regla")}
              />
              Día fijo cada periodo
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={modo === "fecha"}
                onChange={() => setModo("fecha")}
              />
              Fecha puntual
            </label>
          </div>

          {modo === "regla" ? (
            <input
              type="number"
              min={1}
              max={31}
              value={reglaDiaMes}
              onChange={(e) => setReglaDiaMes(e.target.value)}
              className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          ) : (
            <input
              type="date"
              value={fechaPuntual}
              onChange={(e) => setFechaPuntual(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          )}

          <button
            onClick={handleSave}
            disabled={saving || !municipio}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            Guardar
          </button>
          {ica && (
            <button
              onClick={handleRemove}
              disabled={saving}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Quitar ICA
            </button>
          )}
        </div>
      )}
    </div>
  );
}
