"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CustomObligation, CustomObligationType } from "@/lib/types";

const TIPOS: { value: CustomObligationType; label: string }[] = [
  { value: "nomina_electronica", label: "Nómina electrónica" },
  { value: "parafiscales_pila", label: "Parafiscales / PILA" },
  { value: "otro", label: "Otro" },
];

export function CustomObligationsEditor({
  companyId,
  obligations,
  readOnly,
}: {
  companyId: string;
  obligations: CustomObligation[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<CustomObligationType>("nomina_electronica");
  const [nombre, setNombre] = useState("");
  const [modo, setModo] = useState<"regla" | "fecha">("regla");
  const [reglaDiaMes, setReglaDiaMes] = useState("10");
  const [fechaPuntual, setFechaPuntual] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!nombre) return;
    setSaving(true);
    await fetch(`/api/companies/${companyId}/custom-obligations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo,
        nombre,
        regla_dia_mes: modo === "regla" ? Number(reglaDiaMes) : null,
        fecha_puntual: modo === "fecha" ? fechaPuntual : null,
      }),
    });
    setNombre("");
    setSaving(false);
    router.refresh();
  }

  async function handleRemove(id: string) {
    await fetch(`/api/companies/${companyId}/custom-obligations`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ obligation_id: id }),
    });
    router.refresh();
  }

  return (
    <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">
        Nómina electrónica y parafiscales/PILA
      </h2>
      <p className="mb-4 text-xs text-slate-500">
        Define una regla de día fijo cada mes (ej. día 10) o una fecha puntual, según
        aplique a esta empresa.
      </p>

      <div className="mb-4 space-y-2">
        {obligations.length === 0 && (
          <p className="text-sm text-slate-500">Sin obligaciones adicionales cargadas.</p>
        )}
        {obligations.map((o) => (
          <div
            key={o.id}
            className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
          >
            <span>
              <span className="font-medium text-slate-900">{o.nombre}</span> —{" "}
              {o.regla_dia_mes ? `día ${o.regla_dia_mes} de cada mes` : o.fecha_puntual}
            </span>
            {!readOnly && (
              <button
                onClick={() => handleRemove(o.id)}
                className="text-xs font-medium text-red-600 hover:underline"
              >
                Quitar
              </button>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap gap-3">
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as CustomObligationType)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre a mostrar (ej. Nómina electrónica mensual)"
              className="flex-1 min-w-[220px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={modo === "regla"}
                onChange={() => setModo("regla")}
              />
              Día fijo cada mes
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

          <div>
            <button
              onClick={handleAdd}
              disabled={saving || !nombre}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              Agregar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
