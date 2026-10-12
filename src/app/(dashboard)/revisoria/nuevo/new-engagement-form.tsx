"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Company } from "@/lib/types";
import { MATERIALITY_BASES, type MaterialityBase } from "@/lib/audit/planning";

export function NewEngagementForm({
  companies,
  trialBalances,
  defaultRevisor,
}: {
  companies: Company[];
  trialBalances: { id: string; company_id: string; period_start: string; period_end: string }[];
  defaultRevisor: string;
}) {
  const router = useRouter();
  const [companyId, setCompanyId] = useState("");
  const [tbId, setTbId] = useState("");
  const [periodEnd, setPeriodEnd] = useState(`${new Date().getFullYear() - 1}-12-31`);
  const [base, setBase] = useState<MaterialityBase>("activos");
  const [porcentaje, setPorcentaje] = useState(String(MATERIALITY_BASES.activos.porcentaje));
  const [revisor, setRevisor] = useState(defaultRevisor);
  const [tp, setTp] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const tbsForCompany = trialBalances.filter((t) => t.company_id === companyId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/audit/engagements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_id: companyId,
        trial_balance_id: tbId || null,
        period_end: periodEnd,
        materialidad_base: base,
        materialidad_porcentaje: Number(porcentaje.replace(",", ".")),
        revisor_nombre: revisor,
        revisor_tp: tp,
        ciudad,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "No se pudo crear el encargo.");
      return;
    }
    router.push(`/revisoria/${body.engagement.id}`);
    router.refresh();
  }

  const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Empresa</span>
          <select value={companyId} onChange={(e) => { setCompanyId(e.target.value); setTbId(""); }} className={input} required>
            <option value="">Selecciona…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.razon_social}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Balance de prueba</span>
          <select
            value={tbId}
            onChange={(e) => {
              setTbId(e.target.value);
              const tb = trialBalances.find((t) => t.id === e.target.value);
              if (tb) setPeriodEnd(tb.period_end);
            }}
            className={input}
          >
            <option value="">{tbsForCompany.length ? "Selecciona…" : "Sin balance (materialidad manual)"}</option>
            {tbsForCompany.map((t) => (
              <option key={t.id} value={t.id}>Corte {t.period_end}</option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-slate-500">Se importa en Estados financieros.</span>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Fecha de cierre auditada</span>
          <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={input} required />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Base de materialidad</span>
            <select
              value={base}
              onChange={(e) => {
                const b = e.target.value as MaterialityBase;
                setBase(b);
                setPorcentaje(String(MATERIALITY_BASES[b].porcentaje));
              }}
              className={input}
            >
              {(Object.keys(MATERIALITY_BASES) as MaterialityBase[]).map((b) => (
                <option key={b} value={b}>{MATERIALITY_BASES[b].label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Porcentaje</span>
            <input value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)} className={input} inputMode="decimal" />
            <span className="mt-1 block text-xs text-slate-500">Referencia: {MATERIALITY_BASES[base].rango}</span>
          </label>
        </div>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Revisor fiscal</span>
          <input value={revisor} onChange={(e) => setRevisor(e.target.value)} className={input} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Tarjeta profesional</span>
            <input value={tp} onChange={(e) => setTp(e.target.value)} className={input} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Ciudad</span>
            <input value={ciudad} onChange={(e) => setCiudad(e.target.value)} className={input} />
          </label>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={saving || !companyId} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
        {saving ? "Preparando el encargo..." : "Crear encargo y proponer plan"}
      </button>
    </form>
  );
}
