"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteCompanyButton({
  companyId,
  razonSocial,
}: {
  companyId: string;
  razonSocial: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const confirmado = window.confirm(
      `¿Eliminar por completo la empresa "${razonSocial}"?\n\nSe borran también sus responsabilidades, ICA, obligaciones y accesos de colaboradores. Esta acción no se puede deshacer.`
    );
    if (!confirmado) return;

    setLoading(true);
    setError(null);

    const res = await fetch(`/api/companies/${companyId}`, { method: "DELETE" });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo eliminar la empresa.");
      setLoading(false);
      return;
    }

    router.push("/empresas");
    router.refresh();
  }

  return (
    <div className="max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-6">
      <h2 className="mb-1 text-sm font-semibold text-red-900">Eliminar empresa</h2>
      <p className="mb-4 text-xs text-red-700">
        Borra la empresa y todo lo asociado a ella (responsabilidades, ICA, obligaciones,
        accesos de colaboradores). No se puede deshacer.
      </p>
      {error && <p className="mb-3 text-sm text-red-700">{error}</p>}
      <button
        onClick={handleDelete}
        disabled={loading}
        className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
      >
        {loading ? "Eliminando..." : "Eliminar esta empresa"}
      </button>
    </div>
  );
}
