"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Company } from "@/lib/types";

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

export function CompanyForm({ company }: { company?: Company }) {
  const router = useRouter();
  const [form, setForm] = useState({
    nit: company?.nit ?? "",
    dv: company?.dv ?? "",
    razon_social: company?.razon_social ?? "",
    nombre_comercial: company?.nombre_comercial ?? "",
    tipo_contribuyente: company?.tipo_contribuyente ?? "persona_natural",
    regimen: company?.regimen ?? "ordinario",
    municipio: company?.municipio ?? "",
    departamento: company?.departamento ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const url = company ? `/api/companies/${company.id}` : "/api/companies";
    const res = await fetch(url, {
      method: company ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
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
