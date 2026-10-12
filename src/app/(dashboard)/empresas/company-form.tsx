"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Company } from "@/lib/types";
import { FRAMEWORKS, FRAMEWORK_GUIDE, type Framework } from "@/lib/financial/frameworks";
import { evaluateObligation, smmlvFor, TIPOS_SOCIETARIOS } from "@/lib/audit/obligation";

const TIPOS_CONTRIBUYENTE = [
  { value: "persona_natural", label: "Persona natural" },
  { value: "persona_juridica", label: "Persona jurídica" },
];

const REGIMENES = [
  { value: "ordinario", label: "Régimen ordinario" },
  { value: "simple", label: "Régimen Simple de Tributación" },
  { value: "gran_contribuyente", label: "Gran contribuyente" },
  { value: "especial", label: "Régimen especial" },
];

const PERIODICIDADES_IVA = [
  { value: "bimestral", label: "Bimestral" },
  { value: "cuatrimestral", label: "Cuatrimestral" },
];

export function CompanyForm({ company }: { company?: Company }) {
  const router = useRouter();
  const [form, setForm] = useState({
    nit: company?.nit ?? "",
    dv: company?.dv ?? "",
    razon_social: company?.razon_social ?? "",
    nombre_comercial: company?.nombre_comercial ?? "",
    tipo_contribuyente: company?.tipo_contribuyente ?? "persona_natural",
    regimen: company?.regimen ?? "ordinario",
    municipio: company?.municipio ?? "Fonseca",
    departamento: company?.departamento ?? "La Guajira",
    iva_periodicidad: company?.iva_periodicidad ?? "bimestral",
    niif_grupo: company?.niif_grupo ?? "",
    tipo_societario: company?.tipo_societario ?? "",
  });
  const [tieneRevisor, setTieneRevisor] = useState(company?.tiene_revisor_fiscal ?? false);
  // Solo para el asistente: no se guardan
  const [activos, setActivos] = useState("");
  const [ingresos, setIngresos] = useState("");
  const smmlv = smmlvFor(new Date().getFullYear() - 1);
  const parseCop = (v: string) => (v.trim() ? Number(v.replace(/[^\d]/g, "")) : null);
  const evaluacion = evaluateObligation({
    tipo: form.tipo_societario || null,
    activosBrutos: parseCop(activos),
    ingresosBrutos: parseCop(ingresos),
    smmlv: smmlv.value,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.niif_grupo) {
      setError("Indica a qué grupo NIIF pertenece la empresa.");
      return;
    }
    setLoading(true);

    const url = company ? `/api/companies/${company.id}` : "/api/companies";
    const res = await fetch(url, {
      method: company ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, tipo_societario: form.tipo_societario || null, tiene_revisor_fiscal: tieneRevisor }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo guardar la empresa.");
      return;
    }

    const { company: saved } = await res.json();
    router.push(`/empresas/${saved.id}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6"
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">NIT</label>
          <input
            required
            value={form.nit}
            onChange={(e) => update("nit", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="1122813531"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">DV</label>
          <input
            value={form.dv}
            onChange={(e) => update("dv", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="2"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Razón social</label>
        <input
          required
          value={form.razon_social}
          onChange={(e) => update("razon_social", e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="MIRANDA FRIAS JULIO CESAR"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Nombre comercial
        </label>
        <input
          value={form.nombre_comercial}
          onChange={(e) => update("nombre_comercial", e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="ALMACAMPO DE LA GUAJIRA"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Tipo de contribuyente
          </label>
          <select
            value={form.tipo_contribuyente}
            onChange={(e) => update("tipo_contribuyente", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {TIPOS_CONTRIBUYENTE.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Régimen</label>
          <select
            value={form.regimen}
            onChange={(e) => update("regimen", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {REGIMENES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Periodicidad de IVA
        </label>
        <select
          value={form.iva_periodicidad}
          onChange={(e) => update("iva_periodicidad", e.target.value)}
          className="w-full max-w-[220px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {PERIODICIDADES_IVA.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Depende de los ingresos del año anterior de la empresa. Solo importa si tiene la
          responsabilidad 48 (IVA) o 33 (INC) — en cualquier otro caso no afecta nada.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Departamento
          </label>
          <input
            value={form.departamento}
            onChange={(e) => update("departamento", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="La Guajira"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Ciudad/Municipio
          </label>
          <input
            value={form.municipio}
            onChange={(e) => update("municipio", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Fonseca"
          />
        </div>
      </div>

      <fieldset>
        <legend className="mb-1 block text-sm font-medium text-slate-700">
          ¿A qué grupo NIIF pertenece la empresa? *
        </legend>
        <p className="mb-2 text-xs text-slate-500">
          Define el marco técnico (Decreto 2420 de 2015) con el que Contaryx prepara sus estados
          financieros y notas.
        </p>
        <div className="space-y-2">
          {(Object.keys(FRAMEWORKS) as Framework[]).map((g) => (
            <label
              key={g}
              className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${
                form.niif_grupo === g ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <input
                type="radio"
                name="niif_grupo"
                value={g}
                checked={form.niif_grupo === g}
                onChange={() => update("niif_grupo", g)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-slate-900">{FRAMEWORKS[g].label}</span>
                <span className="block text-xs text-slate-500">{FRAMEWORK_GUIDE[g]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-medium text-slate-700">Revisoría fiscal</legend>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600">Tipo societario</span>
            <select
              value={form.tipo_societario}
              onChange={(e) => update("tipo_societario", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Selecciona…</option>
              {TIPOS_SOCIETARIOS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pt-5 text-sm font-medium text-slate-800">
            <input type="checkbox" checked={tieneRevisor} onChange={(e) => setTieneRevisor(e.target.checked)} />
            La empresa tiene revisor fiscal
          </label>
        </div>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs font-medium text-blue-700">¿Está obligada? Evaluar con activos e ingresos</summary>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            <label className="text-xs">
              <span className="mb-1 block text-slate-600">Activos brutos al 31 dic. {smmlv.year}</span>
              <input value={activos} onChange={(e) => setActivos(e.target.value)} inputMode="numeric" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs">
              <span className="mb-1 block text-slate-600">Ingresos brutos {smmlv.year}</span>
              <input value={ingresos} onChange={(e) => setIngresos(e.target.value)} inputMode="numeric" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
          </div>
          <p className="mt-1 text-xs text-slate-500">SMMLV {smmlv.year}: ${smmlv.value.toLocaleString("es-CO")}.</p>
        </details>
        <div
          className={`mt-3 rounded-lg p-3 text-xs ${
            evaluacion.obligada === true ? "bg-amber-50 text-amber-800" : evaluacion.obligada === false ? "bg-slate-50 text-slate-600" : "bg-slate-50 text-slate-600"
          }`}
        >
          <p className="font-semibold">
            {evaluacion.obligada === true
              ? "Sugerencia: obligada a tener revisor fiscal."
              : evaluacion.obligada === false
                ? "Sugerencia: no obligada por la ley general."
                : "Evaluación pendiente o sujeta a norma especial."}
          </p>
          {evaluacion.razones.map((r) => (
            <p key={r}>• {r}</p>
          ))}
          {evaluacion.obligada === true && !tieneRevisor && (
            <button type="button" onClick={() => setTieneRevisor(true)} className="mt-1 font-semibold text-blue-700 underline">
              Marcar que tiene revisor fiscal
            </button>
          )}
        </div>
      </fieldset>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {loading ? "Guardando..." : "Guardar empresa"}
      </button>
    </form>
  );
}
