"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Match, ReconciliationSummary, UnmatchedItem } from "@/lib/ledger/reconcile";
import type { StoredMovementView } from "./types";
import { exportReconciliationToExcel } from "@/lib/export/reconciliation-excel";

const money = (n: number) => {
  const r = Math.round(n * 100) / 100;
  const t = Math.abs(r).toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return r < 0 ? `(${t})` : t;
};
const fecha = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("es-CO");

const CATEGORY_LABEL: Record<UnmatchedItem["categoria"], string> = {
  nota_debito: "Notas débito del banco no registradas en libros",
  nota_credito: "Notas crédito del banco no registradas en libros",
  cheque_pendiente: "Cheques girados pendientes de cobro",
  egreso_pendiente: "Egresos registrados no debitados por el banco",
  consignacion_transito: "Consignaciones en tránsito",
};

const TYPE_LABEL: Record<Match["type"], string> = {
  exacto: "Exacto",
  fecha_cercana: "Fecha cercana",
  agrupado: "Agrupado",
  manual: "Manual",
};

export interface Header {
  razonSocial: string;
  nit: string;
  cuenta: string;
  cuentaContable: string | null;
  periodEnd: string;
  tolerance: number;
  notes: string;
}

export function ReconciliationView({
  id,
  canEdit,
  header,
  bank,
  ledger,
  matches,
  items,
  summary,
}: {
  id: string;
  canEdit: boolean;
  header: Header;
  bank: StoredMovementView[];
  ledger: StoredMovementView[];
  matches: Match[];
  items: UnmatchedItem[];
  summary: ReconciliationSummary;
}) {
  const router = useRouter();
  const [selBank, setSelBank] = useState<Set<string>>(new Set());
  const [selLedger, setSelLedger] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState(header.notes);
  const [showMatched, setShowMatched] = useState(false);

  const byId = useMemo(() => new Map([...bank, ...ledger].map((m) => [m.id, m])), [bank, ledger]);
  const sumSel = (ids: Set<string>) => [...ids].reduce((s, x) => s + (byId.get(x)?.valor ?? 0), 0);
  const diffSel = Math.round((sumSel(selBank) - sumSel(selLedger)) * 100) / 100;

  async function patch(body: object) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/reconciliations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo guardar.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function matchSelected() {
    if (await patch({ action: "match", bank: [...selBank], ledger: [...selLedger] })) {
      setSelBank(new Set());
      setSelLedger(new Set());
    }
  }

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, x: string) => {
    const next = new Set(set);
    if (next.has(x)) next.delete(x);
    else next.add(x);
    setter(next);
  };

  const groups = (Object.keys(CATEGORY_LABEL) as UnmatchedItem["categoria"][])
    .map((cat) => ({ cat, list: items.filter((i) => i.categoria === cat) }))
    .filter((g) => g.list.length > 0);
  const matchedCount = matches.reduce((s, m) => s + m.bank.length + m.ledger.length, 0);
  const total = bank.length + ledger.length;

  const row = (label: string, value: number, strong = false, sign = "") => (
    <tr className={strong ? "border-t border-slate-300 font-semibold text-slate-900" : "text-slate-700"}>
      <td className="py-1 pr-4">
        {sign && <span className="mr-1 text-slate-400">{sign}</span>}
        {label}
      </td>
      <td className="py-1 text-right tabular-nums">{money(value)}</td>
    </tr>
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 print:border-0 print:p-0">
        <div className="mb-4 text-center">
          <p className="text-sm font-bold uppercase text-slate-900">{header.razonSocial}</p>
          <p className="text-xs text-slate-600">NIT {header.nit}</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">Conciliación bancaria · {header.cuenta}</p>
          <p className="text-xs text-slate-600">
            Al {fecha(header.periodEnd)}
            {header.cuentaContable ? ` · Cuenta contable ${header.cuentaContable}` : ""}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <table className="w-full text-sm">
            <tbody>
              {row("Saldo según extracto", summary.saldoExtracto, true)}
              {row("Consignaciones en tránsito", summary.consignacionesTransito, false, "+")}
              {row("Cheques y egresos pendientes de cobro", summary.chequesPendientes, false, "−")}
              {row("Saldo conciliado", summary.saldoExtractoAjustado, true, "=")}
            </tbody>
          </table>
          <table className="w-full text-sm">
            <tbody>
              {row("Saldo según libros", summary.saldoLibros, true)}
              {row("Notas crédito no registradas", summary.notasCredito, false, "+")}
              {row("Notas débito no registradas", summary.notasDebito, false, "−")}
              {row("Saldo conciliado", summary.saldoLibrosAjustado, true, "=")}
            </tbody>
          </table>
        </div>
        <p
          className={`mt-4 rounded-lg px-3 py-2 text-sm font-medium ${
            summary.diferencia === 0 ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"
          }`}
        >
          {summary.diferencia === 0
            ? "La conciliación cuadra: diferencia cero."
            : `Diferencia por explicar: ${money(summary.diferencia)}. Revisa los saldos o las partidas pendientes.`}
        </p>
        <p className="mt-2 text-xs text-slate-500 print:hidden">
          {matchedCount} de {total} movimientos conciliados automáticamente o a mano · tolerancia ±{header.tolerance} días.
        </p>
      </section>

      <div className="flex flex-wrap gap-2 print:hidden">
        <button onClick={() => window.print()} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Imprimir / Guardar PDF
        </button>
        <button
          onClick={() => exportReconciliationToExcel({ header, summary, items, matches, byId })}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Descargar Excel
        </button>
        {canEdit && (
          <button
            onClick={() => patch({ action: "rerun" })}
            disabled={busy}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Volver a emparejar automáticamente
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600 print:hidden">{error}</p>}

      {canEdit && (selBank.size > 0 || selLedger.size > 0) && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm print:hidden">
          <span>
            Extracto: {money(sumSel(selBank))} · Libros: {money(sumSel(selLedger))} ·{" "}
            <b className={diffSel === 0 ? "text-green-700" : "text-red-700"}>Diferencia {money(diffSel)}</b>
          </span>
          <button
            onClick={matchSelected}
            disabled={busy || diffSel !== 0 || selBank.size + selLedger.size < 2}
            className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            Conciliar seleccionadas
          </button>
          <button
            onClick={() => {
              setSelBank(new Set());
              setSelLedger(new Set());
            }}
            className="text-xs text-slate-600 hover:underline"
          >
            Limpiar
          </button>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.cat} className="break-inside-avoid rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            {CATEGORY_LABEL[g.cat]} ({g.list.length}) ·{" "}
            {money(g.list.reduce((s, i) => s + Math.abs(i.movement.valor), 0))}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-slate-500">
                <tr>
                  {canEdit && <th className="w-6 print:hidden" />}
                  <th className="py-1 pr-2">Fecha</th>
                  <th className="py-1 pr-2">Documento</th>
                  <th className="py-1 pr-2">Descripción</th>
                  <th className="py-1 pr-2 text-right">Valor</th>
                  <th className="py-1 pr-2">Tratamiento sugerido</th>
                </tr>
              </thead>
              <tbody>
                {g.list.map((i) => {
                  const m = i.movement;
                  const isBank = i.side === "banco";
                  const sel = isBank ? selBank : selLedger;
                  return (
                    <tr key={m.id} className="border-t border-slate-100 align-top">
                      {canEdit && (
                        <td className="py-1 print:hidden">
                          <input
                            type="checkbox"
                            checked={sel.has(m.id)}
                            onChange={() => (isBank ? toggle(selBank, setSelBank, m.id) : toggle(selLedger, setSelLedger, m.id))}
                          />
                        </td>
                      )}
                      <td className="whitespace-nowrap py-1 pr-2">
                        {fecha(m.fecha)}
                        {i.antigua && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-700">+30 días</span>}
                      </td>
                      <td className="py-1 pr-2">{m.documento}</td>
                      <td className="py-1 pr-2">{m.descripcion}</td>
                      <td className="py-1 pr-2 text-right tabular-nums">{money(m.valor)}</td>
                      <td className="py-1 pr-2 text-slate-600">
                        <b className="text-slate-800">{i.suggestion.concepto}</b>
                        {i.suggestion.cuenta && <span className="ml-1 font-mono">({i.suggestion.cuenta})</span>}
                        <span className="block">{i.suggestion.nota}</span>
                        {i.posibleDiferencia && (
                          <span className="block text-red-700">
                            Posible error de valor: en libros hay {money(i.posibleDiferencia.valor)} con la misma referencia.
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 print:hidden">
        <button onClick={() => setShowMatched(!showMatched)} className="text-sm font-semibold text-slate-900">
          {showMatched ? "▾" : "▸"} Partidas conciliadas ({matches.length} emparejamientos)
        </button>
        {showMatched && (
          <div className="mt-3 space-y-2">
            {matches.map((mt, index) => (
              <div key={index} className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-slate-50 p-2 text-xs">
                <div className="flex-1">
                  <span className="mr-2 rounded bg-white px-1.5 py-0.5 font-medium text-slate-600">{TYPE_LABEL[mt.type]}</span>
                  {mt.bank.map((x) => byId.get(x)).filter(Boolean).map((m) => (
                    <span key={m!.id} className="mr-3">
                      Banco {fecha(m!.fecha)} {m!.descripcion} <b>{money(m!.valor)}</b>
                    </span>
                  ))}
                  <span className="mx-1 text-slate-400">↔</span>
                  {mt.ledger.map((x) => byId.get(x)).filter(Boolean).map((m) => (
                    <span key={m!.id} className="mr-3">
                      Libros {fecha(m!.fecha)} {m!.documento} {m!.descripcion} <b>{money(m!.valor)}</b>
                    </span>
                  ))}
                </div>
                {canEdit && (
                  <button onClick={() => patch({ action: "unmatch", index })} disabled={busy} className="text-red-600 hover:underline">
                    Deshacer
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Observaciones</h2>
        {canEdit ? (
          <div className="print:hidden">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-300 p-2 text-sm" />
            <button onClick={() => patch({ notes })} disabled={busy} className="mt-2 rounded-lg border border-slate-300 px-3 py-1 text-xs">
              Guardar observaciones
            </button>
          </div>
        ) : null}
        <p className="hidden whitespace-pre-line text-sm print:block">{notes}</p>
        {!canEdit && <p className="whitespace-pre-line text-sm">{notes || "Sin observaciones."}</p>}
        <div className="mt-12 hidden grid-cols-2 gap-8 text-center text-xs print:grid">
          <div>
            <div className="mx-auto mb-1 w-48 border-t border-slate-400" />
            Elaboró
          </div>
          <div>
            <div className="mx-auto mb-1 w-48 border-t border-slate-400" />
            Revisó
          </div>
        </div>
      </section>
    </div>
  );
}
