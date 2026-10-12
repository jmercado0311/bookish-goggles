"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { IcaPeriodicidad } from "@/lib/types";
import { readFileRows } from "@/lib/files/read-spreadsheet";
import { ICA_PERIODICIDADES, parseIcaSheet, periodTemplate, type IcaRow } from "@/lib/tax-rules/ica-calendar";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export function IcaCalendarForm({
  municipios,
  initial,
}: {
  municipios: string[];
  initial: { municipio: string; year: number; periodicidad: IcaPeriodicidad; rows: IcaRow[] };
}) {
  const router = useRouter();
  const [municipio, setMunicipio] = useState(initial.municipio);
  const [year, setYear] = useState(initial.year);
  const [periodicidad, setPeriodicidad] = useState<IcaPeriodicidad>(initial.periodicidad);
  const [porDigito, setPorDigito] = useState(initial.rows.some((r) => r.last_nit_digit !== null));
  const [rows, setRows] = useState<IcaRow[]>(initial.rows);
  const [fileName, setFileName] = useState<string | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function generate() {
    const labels = periodTemplate(periodicidad, year);
    const next: IcaRow[] = porDigito
      ? labels.flatMap((label) => DIGITS.map((d) => ({ period_label: label, due_date: "", last_nit_digit: d })))
      : labels.map((label) => ({ period_label: label, due_date: "", last_nit_digit: null }));
    if (rows.length && !confirm("Esto reemplaza las filas actuales. ¿Continuar?")) return;
    setRows(next);
  }

  function update(i: number, patch: Partial<IcaRow>) {
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const parsed = parseIcaSheet(await readFileRows(file));
      setMessages(parsed.errors);
      if (parsed.rows.length === 0) {
        setError("No se encontraron fechas válidas en el archivo.");
        return;
      }
      setRows(parsed.rows);
      setPorDigito(parsed.rows.some((r) => r.last_nit_digit !== null));
      setFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer el archivo.");
    }
  }

  async function handleSave() {
    setError(null);
    if (!municipio.trim()) {
      setError("Escribe el municipio.");
      return;
    }
    const filled = rows.filter((r) => r.period_label.trim() || r.due_date);
    if (filled.some((r) => !r.period_label.trim() || !r.due_date)) {
      setError("Cada fila debe tener periodo y fecha (borra las filas que no apliquen).");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/ica-calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        municipio: municipio.trim(),
        year,
        periodicidad,
        source_file_name: fileName,
        entries: filled.map((r) => ({ ...r, last_nit_digit: porDigito ? r.last_nit_digit : null })),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo guardar el calendario.");
      return;
    }
    router.push("/calendario-ica");
    router.refresh();
  }

  const input = "rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Municipio</span>
          <input
            list="municipios"
            value={municipio}
            onChange={(e) => setMunicipio(e.target.value)}
            className={`${input} w-56`}
            placeholder="Ej. Fonseca"
          />
          <datalist id="municipios">
            {municipios.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Año del calendario</span>
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className={`${input} w-28`} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Periodicidad</span>
          <select
            value={periodicidad}
            onChange={(e) => setPeriodicidad(e.target.value as IcaPeriodicidad)}
            className={input}
          >
            {ICA_PERIODICIDADES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
          <input type="checkbox" checked={porDigito} onChange={(e) => setPorDigito(e.target.checked)} />
          Las fechas cambian según el último dígito del NIT
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={generate}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Generar periodos {periodicidad === "anual" ? "" : periodicidad + "es"}
          {porDigito ? " × 10 dígitos" : ""}
        </button>
        <label className="cursor-pointer rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100">
          <input type="file" accept=".xlsx,.csv,.txt" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
          {fileName ? `Importado: ${fileName} (cambiar)` : "Importar desde Excel o CSV"}
        </label>
        <button
          onClick={() => setRows((r) => [...r, { period_label: "", due_date: "", last_nit_digit: null }])}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          + Agregar fila
        </button>
      </div>

      {messages.length > 0 && (
        <ul className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          {messages.map((m) => (
            <li key={m}>• {m}</li>
          ))}
        </ul>
      )}

      {rows.length > 0 && (
        <div className="max-h-[480px] overflow-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2">Periodo gravable</th>
                {porDigito && <th className="px-3 py-2">Último dígito NIT</th>}
                <th className="px-3 py-2">Fecha límite</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-3 py-1.5">
                    <input
                      value={r.period_label}
                      onChange={(e) => update(i, { period_label: e.target.value })}
                      className="w-full rounded border border-slate-200 px-2 py-1"
                    />
                  </td>
                  {porDigito && (
                    <td className="px-3 py-1.5">
                      <select
                        value={r.last_nit_digit ?? ""}
                        onChange={(e) =>
                          update(i, { last_nit_digit: e.target.value === "" ? null : Number(e.target.value) })
                        }
                        className="rounded border border-slate-200 px-2 py-1"
                      >
                        <option value="">Todos</option>
                        {DIGITS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                  <td className="px-3 py-1.5">
                    <input
                      type="date"
                      value={r.due_date}
                      onChange={(e) => update(i, { due_date: e.target.value })}
                      className="rounded border border-slate-200 px-2 py-1"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <button
                      onClick={() => setRows((all) => all.filter((_, j) => j !== i))}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving || rows.length === 0}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {saving ? "Guardando..." : "Guardar calendario ICA"}
      </button>
    </div>
  );
}
