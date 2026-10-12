"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Company } from "@/lib/types";
import {
  detectColumns,
  parseCsv,
  parseTrialBalance,
  type Cell,
  type ColumnKey,
  type ColumnMap,
  type SignMode,
} from "@/lib/financial/parse-trial-balance";
import { RUBRO_BY_KEY } from "@/lib/financial/puc-mapping";
import { FRAMEWORKS, FRAMEWORK_GUIDE, type Framework } from "@/lib/financial/frameworks";

const COLUMN_LABELS: Record<ColumnKey, string> = {
  code: "Código de cuenta *",
  name: "Nombre de la cuenta",
  saldo_anterior: "Saldo anterior / inicial",
  debitos: "Débitos",
  creditos: "Créditos",
  saldo_final: "Saldo final *",
};

const money = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 0 });

/** Valor plano de una celda de ExcelJS (fórmulas, texto enriquecido, fechas). */
function plainCellValue(value: unknown): Cell {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as { result?: unknown; richText?: { text: string }[]; text?: string };
    if (v.result !== undefined) return plainCellValue(v.result);
    if (v.richText) return v.richText.map((t) => t.text).join("");
    if (v.text !== undefined) return v.text;
  }
  return String(value);
}

async function readFileRows(file: File): Promise<Cell[][]> {
  if (/\.(csv|txt)$/i.test(file.name)) {
    const buffer = await file.arrayBuffer();
    // Muchos programas contables exportan CSV en Windows-1252 (tildes)
    let text = new TextDecoder("utf-8").decode(buffer);
    if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buffer);
    return parseCsv(text);
  }
  if (/\.xls$/i.test(file.name)) {
    throw new Error("El formato .xls (Excel 97-2003) no es compatible. Ábrelo en Excel y guárdalo como .xlsx.");
  }
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("El archivo no tiene hojas.");
  const rows: Cell[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const values = row.values as unknown[]; // índice 0 vacío en ExcelJS
    rows[rowNumber - 1] = values.slice(1).map(plainCellValue);
  });
  return Array.from(rows, (r) => r ?? []);
}

export function ImportWizard({
  companies,
  defaultCompanyId,
}: {
  companies: Company[];
  defaultCompanyId?: string;
}) {
  const router = useRouter();
  const lastYear = new Date().getFullYear() - 1;
  const [companyId, setCompanyId] = useState(defaultCompanyId ?? "");
  const [periodStart, setPeriodStart] = useState(`${lastYear}-01-01`);
  const [periodEnd, setPeriodEnd] = useState(`${lastYear}-12-31`);
  // Grupo elegido aquí solo cuando la empresa todavía no lo tiene definido
  const [grupoElegido, setGrupoElegido] = useState<Framework | "">("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Cell[][] | null>(null);
  const [headerRow, setHeaderRow] = useState(0);
  const [columns, setColumns] = useState<ColumnMap | null>(null);
  const [signMode, setSignMode] = useState<SignMode>("auto");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    try {
      const data = await readFileRows(file);
      const detected = detectColumns(data);
      setRows(data);
      setHeaderRow(detected.headerRow);
      setColumns(detected.columns);
      setFileName(file.name);
    } catch (err) {
      setRows(null);
      setError(err instanceof Error ? err.message : "No se pudo leer el archivo.");
    }
  }

  const result = useMemo(
    () => (rows && columns ? parseTrialBalance(rows, headerRow, columns, signMode) : null),
    [rows, headerRow, columns, signMode]
  );

  const totals = useMemo(() => {
    if (!result) return null;
    const t = { activo: 0, pasivo: 0, patrimonio: 0, resultados: 0 };
    for (const l of result.lines) {
      const section = RUBRO_BY_KEY.get(l.rubro)?.section ?? "";
      if (section.startsWith("activo")) t.activo += l.saldo_final;
      else if (section.startsWith("pasivo")) t.pasivo -= l.saldo_final;
      else if (section === "patrimonio") t.patrimonio -= l.saldo_final;
      else if (section === "resultados") t.resultados -= l.saldo_final;
    }
    return t;
  }, [result]);

  const headers = rows?.[headerRow]?.map((c, i) => `${String.fromCharCode(65 + (i % 26))}: ${c ?? ""}`) ?? [];

  const company = companies.find((c) => c.id === companyId);
  const grupo: Framework | "" = company?.niif_grupo ?? grupoElegido;

  async function handleSave() {
    if (!result || !companyId) return;
    if (!grupo) {
      setError("Indica a qué grupo NIIF pertenece la empresa.");
      return;
    }
    setError(null);
    setSaving(true);

    if (!company?.niif_grupo) {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niif_grupo: grupo }),
      });
      if (!res.ok) {
        setSaving(false);
        setError("No se pudo guardar el grupo NIIF de la empresa.");
        return;
      }
    }
    const res = await fetch("/api/financial/trial-balances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_id: companyId,
        period_start: periodStart,
        period_end: periodEnd,
        source_file_name: fileName,
        lines: result.lines,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "No se pudo guardar el balance.");
      return;
    }
    router.push(`/financieros/${body.trial_balance.id}`);
    router.refresh();
  }

  const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

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
        <div className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Grupo NIIF de la empresa</span>
          {!company ? (
            <p className="text-xs text-slate-500">Selecciona primero la empresa.</p>
          ) : company.niif_grupo ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700">
              {FRAMEWORKS[company.niif_grupo].label}
              <a href={`/empresas/${company.id}`} className="ml-2 text-xs text-blue-600 hover:underline">
                cambiar
              </a>
            </p>
          ) : (
            <div className="space-y-1">
              <p className="text-xs font-medium text-amber-700">
                Esta empresa aún no tiene grupo NIIF. ¿A cuál pertenece?
              </p>
              {(Object.keys(FRAMEWORKS) as Framework[]).map((g) => (
                <label key={g} className="flex gap-2 text-xs" title={FRAMEWORK_GUIDE[g]}>
                  <input type="radio" name="grupo" checked={grupoElegido === g} onChange={() => setGrupoElegido(g)} />
                  {FRAMEWORKS[g].label}
                </label>
              ))}
            </div>
          )}
        </div>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Periodo desde</span>
          <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={input} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Periodo hasta (fecha de corte)</span>
          <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={input} />
        </label>
        <div className="md:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700">Archivo del balance de prueba</span>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100">
            <input
              type="file"
              accept=".xlsx,.csv,.txt"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {fileName ? `Archivo: ${fileName} (cambiar)` : "Elegir archivo Excel (.xlsx) o CSV"}
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Si el balance trae varios niveles (clase, grupo, cuenta, subcuenta, auxiliar), la app toma
            solo el último nivel para no duplicar saldos. El archivo se lee en tu navegador.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {rows && columns && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Columnas detectadas</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">Fila de encabezados</span>
              <input
                type="number"
                min={1}
                value={headerRow + 1}
                onChange={(e) => setHeaderRow(Math.max(0, Number(e.target.value) - 1))}
                className={input}
              />
            </label>
            {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map((key) => (
              <label key={key} className="text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-600">{COLUMN_LABELS[key]}</span>
                <select
                  value={columns[key] ?? ""}
                  onChange={(e) =>
                    setColumns({ ...columns, [key]: e.target.value === "" ? null : Number(e.target.value) })
                  }
                  className={input}
                >
                  <option value="">(no tiene)</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">Formato de los saldos</span>
              <select value={signMode} onChange={(e) => setSignMode(e.target.value as SignMode)} className={input}>
                <option value="auto">
                  Automático{result ? ` (detectado: ${result.detectedSignMode === "nature" ? "según naturaleza" : "débito +, crédito -"})` : ""}
                </option>
                <option value="debit_positive">Débito positivo, crédito negativo</option>
                <option value="nature">Todos positivos, según naturaleza</option>
              </select>
            </label>
          </div>

          {result && totals && (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {[
                  ["Cuentas", String(result.lines.length)],
                  ["Activo", money(totals.activo)],
                  ["Pasivo", money(totals.pasivo)],
                  ["Patrimonio", money(totals.patrimonio)],
                  ["Resultado del periodo", money(totals.resultados)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="text-sm font-semibold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>

              {result.warnings.length > 0 ? (
                <ul className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {result.warnings.map((w) => (
                    <li key={w}>• {w}</li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                  El balance cuadra: débitos = créditos.
                </p>
              )}

              <div className="max-h-96 overflow-auto rounded-xl border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Código</th>
                      <th className="px-3 py-2">Cuenta</th>
                      <th className="px-3 py-2 text-right">Saldo anterior</th>
                      <th className="px-3 py-2 text-right">Saldo final</th>
                      <th className="px-3 py-2">Rubro NIIF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.lines.map((l) => (
                      <tr key={l.account_code} className="border-t border-slate-100">
                        <td className="px-3 py-1.5 font-mono">{l.account_code}</td>
                        <td className="px-3 py-1.5">{l.account_name}</td>
                        <td className="px-3 py-1.5 text-right">{money(l.saldo_anterior)}</td>
                        <td className="px-3 py-1.5 text-right">{money(l.saldo_final)}</td>
                        <td className={`px-3 py-1.5 ${l.rubro === "sin_clasificar" ? "text-red-600" : "text-slate-600"}`}>
                          {RUBRO_BY_KEY.get(l.rubro)?.label}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">
                Saldos con signo: positivo = débito, negativo = crédito. Podrás reclasificar cuentas
                después de guardar. Si ya existe un balance de esta empresa con la misma fecha de corte,
                se reemplaza (incluidas las notas editadas).
              </p>

              <button
                onClick={handleSave}
                disabled={saving || !companyId || result.lines.length === 0}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Guardando..." : !companyId ? "Selecciona la empresa" : "Guardar y generar estados financieros"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
