"use client";

import { useMemo, useState } from "react";
import ExcelJS from "exceljs";
import type { StoredMovementView } from "../../[id]/types";

const money = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 2 });
const PAGE = 200;

export function LedgerBrowser({ label, movements }: { label: string; movements: StoredMovementView[] }) {
  const [cuenta, setCuenta] = useState("");
  const [q, setQ] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [vista, setVista] = useState<"movimientos" | "cuentas" | "terceros">("movimientos");
  const [page, setPage] = useState(0);

  const cuentas = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of movements) if (!map.has(m.cuenta)) map.set(m.cuenta, m.cuenta_nombre);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [movements]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return movements.filter(
      (m) =>
        (!cuenta || m.cuenta.startsWith(cuenta)) &&
        (!desde || m.fecha >= desde) &&
        (!hasta || m.fecha <= hasta) &&
        (!text || `${m.descripcion} ${m.documento} ${m.tercero} ${m.nit}`.toLowerCase().includes(text))
    );
  }, [movements, cuenta, q, desde, hasta]);

  const totals = filtered.reduce((t, m) => ({ d: t.d + m.debito, c: t.c + m.credito }), { d: 0, c: 0 });

  const grouped = useMemo(() => {
    const key = vista === "cuentas" ? (m: StoredMovementView) => m.cuenta : (m: StoredMovementView) => m.nit || m.tercero || "(sin tercero)";
    const name = vista === "cuentas" ? (m: StoredMovementView) => m.cuenta_nombre : (m: StoredMovementView) => m.tercero;
    const map = new Map<string, { key: string; name: string; n: number; d: number; c: number }>();
    for (const m of filtered) {
      const k = key(m);
      const g = map.get(k) ?? { key: k, name: name(m), n: 0, d: 0, c: 0 };
      g.n++;
      g.d += m.debito;
      g.c += m.credito;
      map.set(k, g);
    }
    return [...map.values()].sort((a, b) => (vista === "cuentas" ? a.key.localeCompare(b.key) : b.d + b.c - (a.d + a.c)));
  }, [filtered, vista]);

  async function exportExcel() {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Auxiliar");
    ws.columns = [
      { header: "Fecha", key: "fecha", width: 12 },
      { header: "Cuenta", key: "cuenta", width: 12 },
      { header: "Nombre cuenta", key: "cuenta_nombre", width: 28 },
      { header: "Documento", key: "documento", width: 14 },
      { header: "NIT", key: "nit", width: 14 },
      { header: "Tercero", key: "tercero", width: 28 },
      { header: "Descripción", key: "descripcion", width: 40 },
      { header: "Débito", key: "debito", width: 16 },
      { header: "Crédito", key: "credito", width: 16 },
      { header: "Saldo", key: "saldo", width: 16 },
    ];
    ws.getRow(1).font = { bold: true };
    for (const m of filtered) ws.addRow(m);
    const buffer = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buffer]));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${label.replace(/\W+/g, "-")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const input = "rounded-lg border border-slate-300 px-3 py-1.5 text-sm";
  const shown = filtered.slice(page * PAGE, (page + 1) * PAGE);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <select value={cuenta} onChange={(e) => { setCuenta(e.target.value); setPage(0); }} className={`${input} max-w-xs`}>
          <option value="">Todas las cuentas</option>
          {cuentas.map(([c, n]) => (
            <option key={c} value={c}>
              {c} {n}
            </option>
          ))}
        </select>
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Tercero, NIT, documento o texto" className={`${input} w-64`} />
        <input type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setPage(0); }} className={input} />
        <input type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setPage(0); }} className={input} />
        <button onClick={exportExcel} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Descargar Excel
        </button>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-xl bg-white px-3 py-2">{filtered.length} movimientos</span>
        <span className="rounded-xl bg-white px-3 py-2">Débitos {money(totals.d)}</span>
        <span className="rounded-xl bg-white px-3 py-2">Créditos {money(totals.c)}</span>
        <span className="rounded-xl bg-white px-3 py-2">Neto {money(totals.d - totals.c)}</span>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {(["movimientos", "cuentas", "terceros"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setVista(v)}
            className={`border-b-2 px-3 py-2 text-sm font-medium capitalize ${vista === v ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500"}`}
          >
            {v === "movimientos" ? "Movimientos" : v === "cuentas" ? "Resumen por cuenta" : "Resumen por tercero"}
          </button>
        ))}
      </div>

      {vista === "movimientos" ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-2 py-2">Fecha</th>
                <th className="px-2 py-2">Cuenta</th>
                <th className="px-2 py-2">Documento</th>
                <th className="px-2 py-2">Tercero</th>
                <th className="px-2 py-2">Descripción</th>
                <th className="px-2 py-2 text-right">Débito</th>
                <th className="px-2 py-2 text-right">Crédito</th>
                <th className="px-2 py-2 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-2 py-1">{m.fecha}</td>
                  <td className="px-2 py-1 font-mono">{m.cuenta}</td>
                  <td className="px-2 py-1">{m.documento}</td>
                  <td className="px-2 py-1">
                    {m.tercero}
                    {m.nit && <span className="block text-slate-400">{m.nit}</span>}
                  </td>
                  <td className="px-2 py-1">{m.descripcion}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{m.debito ? money(m.debito) : ""}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{m.credito ? money(m.credito) : ""}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{m.saldo === null ? "" : money(m.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > PAGE && (
            <div className="flex items-center gap-3 p-3 text-xs">
              <button disabled={page === 0} onClick={() => setPage(page - 1)} className="disabled:opacity-40">← Anterior</button>
              <span>
                Página {page + 1} de {Math.ceil(filtered.length / PAGE)}
              </span>
              <button disabled={(page + 1) * PAGE >= filtered.length} onClick={() => setPage(page + 1)} className="disabled:opacity-40">
                Siguiente →
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-2 py-2">{vista === "cuentas" ? "Cuenta" : "NIT / tercero"}</th>
                <th className="px-2 py-2">Nombre</th>
                <th className="px-2 py-2 text-right">Movimientos</th>
                <th className="px-2 py-2 text-right">Débitos</th>
                <th className="px-2 py-2 text-right">Créditos</th>
                <th className="px-2 py-2 text-right">Neto</th>
              </tr>
            </thead>
            <tbody>
              {grouped.slice(0, 500).map((g) => (
                <tr key={g.key} className="border-t border-slate-100">
                  <td className="px-2 py-1 font-mono">{g.key}</td>
                  <td className="px-2 py-1">{g.name}</td>
                  <td className="px-2 py-1 text-right">{g.n}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{money(g.d)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{money(g.c)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{money(g.d - g.c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
