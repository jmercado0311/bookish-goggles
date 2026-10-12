"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FRAMEWORKS, FRAMEWORK_GUIDE, type Framework } from "@/lib/financial/frameworks";

/** Pide el grupo NIIF de la empresa antes de preparar sus estados financieros. */
export function GroupPrompt({
  companyId,
  razonSocial,
  canEdit,
}: {
  companyId: string;
  razonSocial: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [grupo, setGrupo] = useState<Framework | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!grupo) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/companies/${companyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ niif_grupo: grupo }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("No se pudo guardar el grupo.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6">
      <h1 className="mb-1 text-lg font-semibold text-slate-900">¿A qué grupo NIIF pertenece {razonSocial}?</h1>
      <p className="mb-4 text-sm text-slate-500">
        Contaryx prepara el juego de estados financieros, las notas y la verificación de cumplimiento
        según el marco técnico del grupo (Decreto 2420 de 2015).
      </p>
      {!canEdit ? (
        <p className="text-sm text-amber-700">Pide al administrador del despacho que defina el grupo de esta empresa.</p>
      ) : (
        <>
          <div className="space-y-2">
            {(Object.keys(FRAMEWORKS) as Framework[]).map((g) => (
              <label
                key={g}
                className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${
                  grupo === g ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <input type="radio" name="grupo" checked={grupo === g} onChange={() => setGrupo(g)} className="mt-1" />
                <span>
                  <span className="block text-sm font-medium text-slate-900">{FRAMEWORKS[g].label}</span>
                  <span className="block text-xs text-slate-500">{FRAMEWORK_GUIDE[g]}</span>
                </span>
              </label>
            ))}
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <button
            onClick={save}
            disabled={!grupo || saving}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar y preparar estados financieros"}
          </button>
        </>
      )}
    </div>
  );
}
