"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { extractPdfItems } from "@/lib/pdf-parser/extract-text";
import { parseCandidateEntries } from "@/lib/pdf-parser/parse-dian-calendar";
import { RESPONSIBILITIES_WITH_DEADLINES, responsibilityName } from "@/lib/tax-rules/responsibilities";

interface ReviewRow {
  id: string;
  responsibility_code: string;
  last_nit_digit: number;
  period_label: string;
  due_date: string;
}

export function UploadWizard() {
  const router = useRouter();
  const [year, setYear] = useState(new Date().getFullYear());
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [status, setStatus] = useState<"idle" | "extrayendo" | "revision" | "guardando">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  async function handleExtract() {
    if (!file) return;
    setError(null);
    setStatus("extrayendo");
    try {
      const items = await extractPdfItems(file);
      const candidates = parseCandidateEntries(items, year);
      setRows(
        candidates.map((c, i) => ({
          id: `${i}`,
          responsibility_code: "",
          last_nit_digit: c.last_nit_digit,
          period_label: c.period_label,
          due_date: c.due_date,
        }))
      );
      setStatus("revision");
      if (candidates.length === 0) {
        setError(
          "No se detectaron filas automáticamente. Puedes agregarlas manualmente abajo."
        );
      }
    } catch {
      setError("No se pudo leer el PDF. Intenta con otro archivo o agrega las filas manualmente.");
      setRows([]);
      setStatus("revision");
    }
  }

  function updateRow(id: string, patch: Partial<ReviewRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  function addEmptyRow() {
    setRows((rs) => [
      ...rs,
      {
        id: crypto.randomUUID(),
        responsibility_code: "",
        last_nit_digit: 0,
        period_label: "",
        due_date: "",
      },
    ]);
  }

  async function handleConfirm() {
    setError(null);
    const incomplete = rows.some((r) => !r.responsibility_code || !r.due_date);
    if (incomplete) {
      setError("Completa la responsabilidad y la fecha de cada fila antes de confirmar.");
      return;
    }

    setStatus("guardando");

    let filePath = "";
    if (file) {
      const supabase = createClient();
      const path = `dian/${year}-${Date.now()}-${file.name}`;
      const { data, error: uploadError } = await supabase.storage
        .from("calendarios-dian")
        .upload(path, file);
      if (!uploadError) filePath = data.path;
    }

    const res = await fetch("/api/calendar-uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year,
        file_path: filePath,
        entries: rows.map(({ responsibility_code, last_nit_digit, period_label, due_date }) => ({
          responsibility_code,
          last_nit_digit,
          period_label,
          due_date,
        })),
      }),
    });

    setStatus("revision");

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo guardar el calendario.");
      return;
    }

    router.push("/calendario-dian");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Año</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              PDF del calendario DIAN
            </label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm"
            />
          </div>
        </div>
        <button
          onClick={handleExtract}
          disabled={!file || status === "extrayendo"}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {status === "extrayendo" ? "Extrayendo..." : "Extraer fechas"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {(status === "revision" || status === "guardando") && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Revisa y corrige antes de confirmar
            </h2>
            <button
              onClick={addEmptyRow}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              + Agregar fila manual
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2 pr-2">Responsabilidad</th>
                  <th className="py-2 pr-2">Último dígito NIT</th>
                  <th className="py-2 pr-2">Periodo</th>
                  <th className="py-2 pr-2">Fecha vencimiento</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="py-2 pr-2">
                      <select
                        value={r.responsibility_code}
                        onChange={(e) => updateRow(r.id, { responsibility_code: e.target.value })}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                      >
                        <option value="">Seleccionar...</option>
                        {RESPONSIBILITIES_WITH_DEADLINES.map((code) => (
                          <option key={code} value={code}>
                            {code} — {responsibilityName(code)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        min={0}
                        max={9}
                        value={r.last_nit_digit}
                        onChange={(e) =>
                          updateRow(r.id, { last_nit_digit: Number(e.target.value) })
                        }
                        className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        value={r.period_label}
                        onChange={(e) => updateRow(r.id, { period_label: e.target.value })}
                        className="w-40 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="date"
                        value={r.due_date}
                        onChange={(e) => updateRow(r.id, { due_date: e.target.value })}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => removeRow(r.id)}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p className="py-4 text-sm text-slate-500">Sin filas. Agrega manualmente.</p>
            )}
          </div>

          <button
            onClick={handleConfirm}
            disabled={status === "guardando" || rows.length === 0}
            className="mt-4 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            {status === "guardando" ? "Guardando..." : "Confirmar y guardar"}
          </button>
        </div>
      )}
    </div>
  );
}
