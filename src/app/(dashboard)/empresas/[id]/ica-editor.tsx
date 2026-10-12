"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CompanyIca, IcaPeriodicidad } from "@/lib/types";
import { ICA_PERIODICIDADES, normalizeMunicipio } from "@/lib/tax-rules/ica-calendar";

type Respaldo = "regla" | "fecha" | "ninguno";

function respaldoDe(ica: CompanyIca): Respaldo {
  return ica.fecha_puntual ? "fecha" : ica.regla_dia_mes ? "regla" : "ninguno";
}

const periodicidadLabel = (p: string) => ICA_PERIODICIDADES.find((x) => x.value === p)?.label ?? p;

/** Un municipio donde la empresa declara ICA. */
function IcaRow({
  companyId,
  ica,
  conCalendario,
  readOnly,
}: {
  companyId: string;
  ica: CompanyIca;
  conCalendario: boolean;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [periodicidad, setPeriodicidad] = useState(ica.periodicidad);
  const [respaldo, setRespaldo] = useState<Respaldo>(respaldoDe(ica));
  const [dia, setDia] = useState(String(ica.regla_dia_mes ?? "15"));
  const [fecha, setFecha] = useState(ica.fecha_puntual ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    periodicidad !== ica.periodicidad ||
    respaldo !== respaldoDe(ica) ||
    (respaldo === "regla" && Number(dia) !== ica.regla_dia_mes) ||
    (respaldo === "fecha" && fecha !== (ica.fecha_puntual ?? ""));

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/companies/${companyId}/ica`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ica_id: ica.id,
        periodicidad,
        regla_dia_mes: respaldo === "regla" ? Number(dia) : null,
        fecha_puntual: respaldo === "fecha" ? fecha : null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("No se pudo guardar.");
      return;
    }
    router.refresh();
  }

  async function remove() {
    if (!confirm(`¿Quitar el ICA de ${ica.municipio} para esta empresa?`)) return;
    setSaving(true);
    await fetch(`/api/companies/${companyId}/ica`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ica_id: ica.id }),
    });
    setSaving(false);
    router.refresh();
  }

  const calendarLink = `/calendario-ica/nuevo?municipio=${encodeURIComponent(ica.municipio)}&periodicidad=${ica.periodicidad}&year=${new Date().getFullYear()}`;

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{ica.municipio}</p>
        {conCalendario ? (
          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
            Calendario {periodicidadLabel(ica.periodicidad).toLowerCase()} cargado
          </span>
        ) : readOnly ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">Sin calendario</span>
        ) : (
          <Link
            href={calendarLink}
            className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-200"
          >
            Sin calendario · cargarlo
          </Link>
        )}
      </div>

      {readOnly ? (
        <p className="text-sm text-slate-600">
          {periodicidadLabel(ica.periodicidad)}
          {!conCalendario && ica.regla_dia_mes ? ` · día ${ica.regla_dia_mes} de cada mes` : ""}
          {!conCalendario && ica.fecha_puntual ? ` · ${ica.fecha_puntual}` : ""}
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <select
              value={periodicidad}
              onChange={(e) => setPeriodicidad(e.target.value as IcaPeriodicidad)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              {ICA_PERIODICIDADES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            {!conCalendario && (
              <>
                <span className="text-xs text-slate-500">Respaldo mientras no haya calendario:</span>
                <select
                  value={respaldo}
                  onChange={(e) => setRespaldo(e.target.value as Respaldo)}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                >
                  <option value="ninguno">Ninguno</option>
                  <option value="regla">Día fijo cada mes</option>
                  <option value="fecha">Fecha puntual</option>
                </select>
                {respaldo === "regla" && (
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={dia}
                    onChange={(e) => setDia(e.target.value)}
                    className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  />
                )}
                {respaldo === "fecha" && (
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  />
                )}
              </>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            {dirty && (
              <button
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                Guardar cambios
              </button>
            )}
            <button
              onClick={remove}
              disabled={saving}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Quitar municipio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function IcaEditor({
  companyId,
  icas,
  municipiosConCalendario,
  defaultMunicipio,
  readOnly,
}: {
  companyId: string;
  icas: CompanyIca[];
  /** Claves "municipio normalizado|periodicidad" con calendario del año en curso. */
  municipiosConCalendario: string[];
  defaultMunicipio: string | null;
  readOnly: boolean;
}) {
  const router = useRouter();
  const conCalendario = new Set(municipiosConCalendario);
  const [municipio, setMunicipio] = useState(icas.length === 0 ? (defaultMunicipio ?? "") : "");
  const [periodicidad, setPeriodicidad] = useState<IcaPeriodicidad>("bimestral");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/companies/${companyId}/ica`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ municipio, periodicidad }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo agregar el municipio.");
      return;
    }
    setMunicipio("");
    router.refresh();
  }

  const sorted = [...icas].sort((a, b) => a.municipio.localeCompare(b.municipio, "es"));

  return (
    <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">ICA por municipio (opcional)</h2>
      <p className="mb-4 text-xs text-slate-500">
        Agrega cada municipio donde la empresa declara industria y comercio (sede principal,
        sucursales, obras o actividades en otras ciudades). Las fechas de cada uno salen del{" "}
        <Link href="/calendario-ica" className="text-blue-600 hover:underline">
          calendario ICA
        </Link>{" "}
        que tu despacho cargue para ese municipio.
      </p>

      <div className="space-y-3">
        {sorted.length === 0 && <p className="text-sm text-slate-500">Sin municipios de ICA registrados.</p>}
        {sorted.map((ica) => (
          <IcaRow
            key={`${ica.id}-${ica.periodicidad}-${ica.regla_dia_mes}-${ica.fecha_puntual}`}
            companyId={companyId}
            ica={ica}
            conCalendario={conCalendario.has(`${normalizeMunicipio(ica.municipio)}|${ica.periodicidad}`)}
            readOnly={readOnly}
          />
        ))}
      </div>

      {!readOnly && (
        <form onSubmit={add} className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-700">Municipio</span>
            <input
              required
              value={municipio}
              onChange={(e) => setMunicipio(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Ej. Riohacha"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-700">Periodicidad</span>
            <select
              value={periodicidad}
              onChange={(e) => setPeriodicidad(e.target.value as IcaPeriodicidad)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {ICA_PERIODICIDADES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={saving || !municipio.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            + Agregar municipio
          </button>
          {error && <p className="w-full text-sm text-red-600">{error}</p>}
        </form>
      )}
    </div>
  );
}
