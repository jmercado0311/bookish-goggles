"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Company } from "@/lib/types";

export interface ImportOption {
  id: string;
  company_id: string;
  kind: "extracto" | "auxiliar";
  label: string;
  period_start: string | null;
  period_end: string | null;
  saldo_final: number | null;
  movement_count: number;
}

interface AccountSummary {
  cuenta: string;
  nombre: string;
  movimientos: number;
  neto: number;
  ultimoSaldo: number | null;
}

export function NewReconciliationForm({
  companies,
  imports,
  initial,
}: {
  companies: Company[];
  imports: ImportOption[];
  initial: { companyId: string; extractoId: string; auxiliarId: string };
}) {
  const router = useRouter();
  const [companyId, setCompanyId] = useState(initial.companyId);
  const [extractoId, setExtractoId] = useState(initial.extractoId);
  const [auxiliarId, setAuxiliarId] = useState(initial.auxiliarId);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [cuenta, setCuenta] = useState("");
  const initialExtracto = imports.find((i) => i.id === initial.extractoId);
  const [saldoExtracto, setSaldoExtracto] = useState(
    initialExtracto?.saldo_final !== null && initialExtracto?.saldo_final !== undefined ? String(initialExtracto.saldo_final) : ""
  );
  const [saldoLibros, setSaldoLibros] = useState("");
  const [periodEnd, setPeriodEnd] = useState(initialExtracto?.period_end ?? "");
  const [tolerance, setTolerance] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const extractos = imports.filter((i) => i.kind === "extracto" && i.company_id === companyId);
  const auxiliares = imports.filter((i) => i.kind === "auxiliar" && i.company_id === companyId);
  const extracto = imports.find((i) => i.id === extractoId);

  // Al elegir el extracto: saldo final y fecha de corte sugeridos
  function selectExtracto(id: string) {
    setExtractoId(id);
    const e = imports.find((i) => i.id === id);
    if (e?.saldo_final !== null && e?.saldo_final !== undefined) setSaldoExtracto(String(e.saldo_final));
    if (e?.period_end) setPeriodEnd(e.period_end);
  }

  // Al elegir el auxiliar: sus cuentas; si solo hay una, queda seleccionada
  useEffect(() => {
    if (!auxiliarId) return;
    let cancelled = false;
    fetch(`/api/ledger-imports/${auxiliarId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list: AccountSummary[] = data.accounts ?? [];
        setAccounts(list);
        const banks = list.filter((a) => a.cuenta.startsWith("1110") || a.cuenta.startsWith("1120"));
        const pick = list.length === 1 ? list[0] : banks.length === 1 ? banks[0] : null;
        if (pick) {
          setCuenta(pick.cuenta);
          if (pick.ultimoSaldo !== null) setSaldoLibros(String(pick.ultimoSaldo));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [auxiliarId]);

  function selectAccount(code: string) {
    setCuenta(code);
    const acc = accounts.find((a) => a.cuenta === code);
    if (acc?.ultimoSaldo !== null && acc?.ultimoSaldo !== undefined) setSaldoLibros(String(acc.ultimoSaldo));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch("/api/reconciliations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_id: companyId,
        bank_import_id: extractoId,
        ledger_import_id: auxiliarId,
        cuenta_label: extracto?.label ?? "Cuenta bancaria",
        cuenta_contable: cuenta,
        period_end: periodEnd,
        saldo_extracto: Number(saldoExtracto),
        saldo_libros: Number(saldoLibros),
        tolerance_days: tolerance,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "No se pudo crear la conciliación.");
      return;
    }
    router.push(`/conciliaciones/${body.reconciliation.id}`);
    router.refresh();
  }

  const back = (tipo: string) =>
    `/conciliaciones/importar?tipo=${tipo}&empresa=${companyId}&volver=${encodeURIComponent(
      `/conciliaciones/nueva?empresa=${companyId}${extractoId ? `&extracto=${extractoId}` : ""}${auxiliarId ? `&auxiliar=${auxiliarId}` : ""}`
    )}`;
  const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Empresa</span>
        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={input} required>
          <option value="">Selecciona…</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.razon_social}
            </option>
          ))}
        </select>
      </label>

      {companyId && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Extracto bancario</span>
              <select value={extractoId} onChange={(e) => selectExtracto(e.target.value)} className={input} required>
                <option value="">Selecciona…</option>
                {extractos.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label} ({i.movement_count} mov.)
                  </option>
                ))}
              </select>
              <Link href={back("extracto")} className="mt-1 inline-block text-xs text-blue-600 hover:underline">
                + Importar un extracto nuevo
              </Link>
            </div>
            <div className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Libro auxiliar</span>
              <select value={auxiliarId} onChange={(e) => setAuxiliarId(e.target.value)} className={input} required>
                <option value="">Selecciona…</option>
                {auxiliares.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label} ({i.movement_count} mov.)
                  </option>
                ))}
              </select>
              <Link href={back("auxiliar")} className="mt-1 inline-block text-xs text-blue-600 hover:underline">
                + Importar un auxiliar nuevo
              </Link>
            </div>
          </div>

          {accounts.length > 1 && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Cuenta contable del banco en el auxiliar</span>
              <select value={cuenta} onChange={(e) => selectAccount(e.target.value)} className={input} required>
                <option value="">Selecciona…</option>
                {accounts.map((a) => (
                  <option key={a.cuenta || "sin"} value={a.cuenta}>
                    {a.cuenta || "(sin código)"} {a.nombre} · {a.movimientos} mov.
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="grid gap-4 md:grid-cols-4">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Fecha de corte</span>
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={input} required />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Saldo según extracto</span>
              <input value={saldoExtracto} onChange={(e) => setSaldoExtracto(e.target.value)} className={input} required inputMode="decimal" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Saldo según libros</span>
              <input value={saldoLibros} onChange={(e) => setSaldoLibros(e.target.value)} className={input} required inputMode="decimal" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Tolerancia de fechas</span>
              <select value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))} className={input}>
                {[0, 2, 3, 5, 7, 10, 15].map((d) => (
                  <option key={d} value={d}>
                    {d === 0 ? "Misma fecha" : `±${d} días`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving || !extractoId || !auxiliarId}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {saving ? "Conciliando..." : "Conciliar automáticamente"}
      </button>
    </form>
  );
}
