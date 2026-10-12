"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Settings {
  id: string;
  representante_legal: string | null;
  contador_nombre: string | null;
  contador_tp: string | null;
  revisor_fiscal_nombre: string | null;
  revisor_fiscal_tp: string | null;
}

const FIELDS: { key: keyof Omit<Settings, "id">; label: string }[] = [
  { key: "representante_legal", label: "Representante legal" },
  { key: "contador_nombre", label: "Contador público" },
  { key: "contador_tp", label: "T.P. del contador" },
  { key: "revisor_fiscal_nombre", label: "Revisor fiscal" },
  { key: "revisor_fiscal_tp", label: "T.P. del revisor fiscal" },
];

export function ReportSettings({
  trialBalance,
  companyId,
  tieneRevisor,
}: {
  trialBalance: Settings;
  companyId: string;
  tieneRevisor: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Settings>(trialBalance);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { id, ...body } = form;
    await fetch(`/api/financial/trial-balances/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm("¿Eliminar este balance de prueba, sus clasificaciones y notas editadas?")) return;
    await fetch(`/api/financial/trial-balances/${trialBalance.id}`, { method: "DELETE" });
    router.push("/financieros");
    router.refresh();
  }

  if (!open) {
    return (
      <div className="flex gap-2">
        <a
          href={`/financieros/nuevo?empresa=${companyId}`}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Subir otro periodo
        </a>
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Firmas
        </button>
      </div>
    );
  }

  const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
  return (
    <form onSubmit={save} className="w-full max-w-xl space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.filter((f) => tieneRevisor || !f.key.startsWith("revisor")).map((f) => (
          <label key={f.key} className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600">{f.label}</span>
            <input
              value={form[f.key] ?? ""}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              className={input}
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap justify-between gap-2">
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
            Cancelar
          </button>
        </div>
        <button type="button" onClick={remove} className="text-sm text-red-600 hover:underline">
          Eliminar balance
        </button>
      </div>
    </form>
  );
}
