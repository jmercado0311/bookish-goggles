"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Company } from "@/lib/types";
import { readFileRows } from "@/lib/files/read-spreadsheet";
import {
  applyMapping,
  chronological,
  detectMapping,
  FIELD_LABELS,
  fixSigns,
  inferBalances,
  parseStatementText,
  pdfItemsToLines,
  type Cell,
  type ColumnMapping,
  type FieldKey,
  type Movement,
  type SourceKind,
} from "@/lib/ledger/parse-movements";

const money = (n: number | null) => (n === null ? "" : n.toLocaleString("es-CO", { maximumFractionDigits: 2 }));
const CONFIDENT = 0.85;

type Method = "reglas" | "ia" | "manual";

export function LedgerImporter({
  companies,
  kind,
  defaultCompanyId,
  returnTo,
}: {
  companies: Company[];
  kind: SourceKind;
  defaultCompanyId?: string;
  returnTo?: string;
}) {
  const router = useRouter();
  const [companyId, setCompanyId] = useState(defaultCompanyId ?? "");
  const [label, setLabel] = useState("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Cell[][] | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [pdfMovements, setPdfMovements] = useState<Movement[] | null>(null);
  const [method, setMethod] = useState<Method>("reglas");
  const [status, setStatus] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saldoInicial, setSaldoInicial] = useState("");
  const [saldoFinal, setSaldoFinal] = useState("");
  const [saving, setSaving] = useState(false);

  const year = new Date().getFullYear();

  const result = useMemo(() => {
    if (pdfMovements) return { movements: pdfMovements, warnings: [], parsedRatio: 1, continuity: null };
    if (rows && mapping) return applyMapping(rows, mapping, kind);
    return null;
  }, [rows, mapping, pdfMovements, kind]);

  function setBalances(movements: Movement[], inicial?: number | null, final?: number | null) {
    const inferred = inferBalances(movements);
    const i = inicial ?? inferred.inicial;
    const f = final ?? inferred.final;
    setSaldoInicial(i === null ? "" : String(i));
    setSaldoFinal(f === null ? "" : String(f));
  }

  async function askAi(body: object) {
    const res = await fetch("/api/ai/ledger-structure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "No se pudo consultar la IA.");
    return data;
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setAiNote(null);
    setRows(null);
    setMapping(null);
    setPdfMovements(null);
    setFileName(file.name);
    if (!label) setLabel(file.name.replace(/\.[^.]+$/, ""));

    try {
      if (/\.pdf$/i.test(file.name)) {
        setStatus("Leyendo el PDF…");
        const { extractPdfItems } = await import("@/lib/pdf-parser/extract-text");
        const lines = pdfItemsToLines(await extractPdfItems(file));
        const detected = parseStatementText(lines, year);
        if (detected.confidence >= CONFIDENT) {
          setMethod("reglas");
          setPdfMovements(chronological(detected.outcome.movements));
          setBalances(detected.outcome.movements);
        } else {
          setStatus("El formato del PDF no es estándar: analizándolo con IA…");
          const ai = await askAi({ mode: "pdf", text: lines.join("\n"), year });
          const movements: Movement[] = ai.movimientos.map(
            (m: { fecha: string; descripcion: string; documento: string; valor: number; saldo: number | null }, i: number) => ({
              row: i + 1,
              fecha: m.fecha,
              descripcion: m.descripcion,
              documento: m.documento,
              tercero: "",
              nit: "",
              cuenta: "",
              cuenta_nombre: "",
              debito: m.valor < 0 ? -m.valor : 0,
              credito: m.valor > 0 ? m.valor : 0,
              saldo: m.saldo,
              valor: m.valor,
            })
          );
          setMethod("ia");
          setAiNote(`La IA leyó ${movements.length} movimientos del texto del PDF.`);
          setPdfMovements(movements);
          setBalances(movements, ai.saldo_inicial, ai.saldo_final);
        }
        setStatus(null);
        return;
      }

      setStatus("Leyendo el archivo…");
      const data = await readFileRows(file);
      setRows(data);
      const detected = detectMapping(data, kind);
      if (detected.confidence >= CONFIDENT) {
        setMethod("reglas");
        setMapping(detected.mapping);
        setBalances(detected.outcome.movements);
        setStatus(null);
        return;
      }
      setStatus("No reconocí la estructura con certeza: consultando a la IA (solo encabezados y una muestra)…");
      try {
        const ai = await askAi({ mode: "mapping", kind, rows: data.slice(0, 45) });
        const fixed = fixSigns(data, ai.mapping as ColumnMapping, kind);
        setMethod("ia");
        setAiNote(ai.explicacion);
        setMapping(fixed.mapping);
        setBalances(fixed.result.movements);
      } catch (err) {
        // Sin IA: se deja la propuesta de las reglas para que el usuario la ajuste
        setMethod("manual");
        setMapping(detected.mapping);
        setError(`${err instanceof Error ? err.message : "La IA no respondió."} Ajusta las columnas abajo.`);
      }
      setStatus(null);
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : "No se pudo leer el archivo.");
    }
  }

  function updateColumn(field: FieldKey, value: string) {
    if (!mapping) return;
    const columns = { ...mapping.columns };
    if (value === "") delete columns[field];
    else columns[field] = Number(value);
    setMethod("manual");
    setMapping({ ...mapping, columns });
  }

  async function handleSave() {
    if (!result || !companyId || !label.trim()) {
      setError("Elige la empresa y escribe un nombre para identificar el archivo.");
      return;
    }
    setSaving(true);
    setError(null);
    const movements = chronological(result.movements);
    const res = await fetch("/api/ledger-imports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_id: companyId,
        kind,
        label,
        source_file_name: fileName,
        method,
        mapping,
        saldo_inicial: saldoInicial === "" ? null : Number(saldoInicial),
        saldo_final: saldoFinal === "" ? null : Number(saldoFinal),
        movements,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "No se pudo guardar.");
      return;
    }
    router.push(returnTo ? `${returnTo}${returnTo.includes("?") ? "&" : "?"}${kind}=${body.import.id}` : "/conciliaciones");
    router.refresh();
  }

  const headers = rows && mapping ? (rows[mapping.headerRow] ?? []).map((c, i) => `${i + 1}. ${c ?? ""}`) : [];
  const maxCols = rows ? Math.max(...rows.slice(0, 60).map((r) => r?.length ?? 0)) : 0;
  const options = headers.length >= maxCols ? headers : Array.from({ length: maxCols }, (_, i) => headers[i] ?? `${i + 1}.`);
  const totals = result
    ? result.movements.reduce((t, m) => ({ entradas: t.entradas + Math.max(0, m.valor), salidas: t.salidas + Math.max(0, -m.valor) }), { entradas: 0, salidas: 0 })
    : null;
  const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
  const fields: FieldKey[] =
    kind === "extracto"
      ? ["fecha", "descripcion", "documento", "debito", "credito", "valor", "tipo", "saldo"]
      : ["fecha", "cuenta", "cuenta_nombre", "documento", "tercero", "nit", "descripcion", "debito", "credito", "valor", "tipo", "saldo"];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Empresa</span>
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={input}>
            <option value="">Selecciona…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.razon_social} · NIT {c.nit}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">
            {kind === "extracto" ? "Cuenta bancaria (nombre para identificarla)" : "Nombre del auxiliar"}
          </span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={input}
            placeholder={kind === "extracto" ? "Bancolombia ahorros 1234 · enero" : "Auxiliar bancos enero 2026"}
          />
        </label>
        <div className="md:col-span-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100">
            <input
              type="file"
              accept={kind === "extracto" ? ".xlsx,.csv,.txt,.pdf" : ".xlsx,.csv,.txt"}
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {fileName ? `Archivo: ${fileName} (cambiar)` : kind === "extracto" ? "Elegir extracto (Excel, CSV o PDF)" : "Elegir auxiliar (Excel o CSV)"}
          </label>
          <p className="mt-1 text-xs text-slate-500">
            {kind === "extracto"
              ? "De cualquier banco. Contaryx reconoce las columnas, el orden de las fechas y el signo de los valores verificando que el saldo cuadre fila a fila."
              : "De cualquier sistema contable (Siigo, World Office, Alegra, Helisa, ContaPyme…), con una o varias cuentas."}{" "}
            Si no reconoce el formato, consulta a la IA con solo los encabezados y una muestra de filas.
          </p>
        </div>
      </div>

      {status && <p className="text-sm text-blue-700">{status}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                method === "ia" ? "bg-violet-100 text-violet-700" : method === "manual" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
              }`}
            >
              {method === "ia" ? "Estructura identificada con IA" : method === "manual" ? "Columnas ajustadas a mano" : "Estructura reconocida automáticamente"}
            </span>
            {result.continuity && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  result.continuity.ok === result.continuity.checked ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                }`}
              >
                Saldo cuadra en {result.continuity.ok} de {result.continuity.checked} movimientos
              </span>
            )}
            {aiNote && <span className="text-xs text-slate-500">{aiNote}</span>}
          </div>

          {rows && mapping && (
            <details className="rounded-xl bg-slate-50 p-3" open={method === "manual"}>
              <summary className="cursor-pointer text-sm font-medium text-slate-700">Columnas detectadas (ajustar)</summary>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <label className="text-xs">
                  <span className="mb-1 block font-medium text-slate-600">Fila de encabezados</span>
                  <input
                    type="number"
                    min={0}
                    value={mapping.headerRow + 1}
                    onChange={(e) => {
                      setMethod("manual");
                      setMapping({ ...mapping, headerRow: Math.max(-1, Number(e.target.value) - 1) });
                    }}
                    className={input}
                  />
                </label>
                <label className="text-xs">
                  <span className="mb-1 block font-medium text-slate-600">Formato de fecha</span>
                  <select
                    value={mapping.dateOrder}
                    onChange={(e) => setMapping({ ...mapping, dateOrder: e.target.value as ColumnMapping["dateOrder"] })}
                    className={input}
                  >
                    <option value="dmy">Día/mes/año</option>
                    <option value="mdy">Mes/día/año</option>
                    <option value="ymd">Año-mes-día</option>
                  </select>
                </label>
                {fields.map((f) => (
                  <label key={f} className="text-xs">
                    <span className="mb-1 block font-medium text-slate-600">{FIELD_LABELS[f]}</span>
                    <select value={mapping.columns[f] ?? ""} onChange={(e) => updateColumn(f, e.target.value)} className={input}>
                      <option value="">(no tiene)</option>
                      {options.map((h, i) => (
                        <option key={i} value={i}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={mapping.columns.valor !== undefined ? !!mapping.invertValor : !!mapping.swapDebitCredit}
                    onChange={(e) =>
                      setMapping(
                        mapping.columns.valor !== undefined
                          ? { ...mapping, invertValor: e.target.checked }
                          : { ...mapping, swapDebitCredit: e.target.checked }
                      )
                    }
                  />
                  Invertir signos
                </label>
              </div>
            </details>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Movimientos</p>
              <p className="text-sm font-semibold">{result.movements.length}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Entradas</p>
              <p className="text-sm font-semibold text-green-700">{money(totals!.entradas)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Salidas</p>
              <p className="text-sm font-semibold text-red-700">{money(totals!.salidas)}</p>
            </div>
            <label className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
              Saldo inicial
              <input value={saldoInicial} onChange={(e) => setSaldoInicial(e.target.value)} className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm" />
            </label>
            <label className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
              Saldo final
              <input value={saldoFinal} onChange={(e) => setSaldoFinal(e.target.value)} className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm" />
            </label>
          </div>

          {result.warnings.length > 0 && (
            <ul className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {result.warnings.map((w) => (
                <li key={w}>• {w}</li>
              ))}
            </ul>
          )}

          <div className="max-h-96 overflow-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-2 py-2">Fecha</th>
                  {kind === "auxiliar" && <th className="px-2 py-2">Cuenta</th>}
                  <th className="px-2 py-2">Documento</th>
                  {kind === "auxiliar" && <th className="px-2 py-2">Tercero</th>}
                  <th className="px-2 py-2">Descripción</th>
                  <th className="px-2 py-2 text-right">Entra / Débito</th>
                  <th className="px-2 py-2 text-right">Sale / Crédito</th>
                  <th className="px-2 py-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {result.movements.slice(0, 300).map((m) => (
                  <tr key={`${m.row}-${m.fecha}-${m.valor}`} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-2 py-1">{m.fecha}</td>
                    {kind === "auxiliar" && <td className="px-2 py-1 font-mono">{m.cuenta}</td>}
                    <td className="px-2 py-1">{m.documento}</td>
                    {kind === "auxiliar" && <td className="px-2 py-1">{m.tercero}</td>}
                    <td className="px-2 py-1">{m.descripcion}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-green-700">{m.valor > 0 ? money(m.valor) : ""}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-red-700">{m.valor < 0 ? money(-m.valor) : ""}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{money(m.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.movements.length > 300 && (
            <p className="text-xs text-slate-500">Se muestran 300 de {result.movements.length}; se guardan todos.</p>
          )}

          <button
            onClick={handleSave}
            disabled={saving || result.movements.length === 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Guardando..." : `Guardar ${kind === "extracto" ? "extracto" : "auxiliar"}`}
          </button>
        </div>
      )}
    </div>
  );
}
