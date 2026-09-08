"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CompanyResponsibility } from "@/lib/types";
import { RUT_RESPONSIBILITY_CODES } from "@/lib/tax-rules/responsibilities";

export function ResponsibilitiesEditor({
  companyId,
  responsibilities,
  readOnly,
}: {
  companyId: string;
  responsibilities: CompanyResponsibility[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [codeToAdd, setCodeToAdd] = useState("");
  const existingCodes = new Set(responsibilities.map((r) => r.code));

  const availableCodes = Object.entries(RUT_RESPONSIBILITY_CODES).filter(
    ([code]) => !existingCodes.has(code)
  );

  async function handleAdd() {
    if (!codeToAdd) return;
    await fetch(`/api/companies/${companyId}/responsibilities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: codeToAdd }),
    });
    setCodeToAdd("");
    router.refresh();
  }

  async function handleRemove(code: string) {
    await fetch(`/api/companies/${companyId}/responsibilities`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    router.refresh();
  }

  return (
    <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">
        Responsabilidades (casilla 53 del RUT)
      </h2>
      <p className="mb-4 text-xs text-slate-500">
        Estas responsabilidades determinan qué vencimientos del calendario DIAN le
        corresponden a esta empresa.
      </p>

      <div className="mb-4 space-y-2">
        {responsibilities.length === 0 && (
          <p className="text-sm text-slate-500">Sin responsabilidades cargadas todavía.</p>
        )}
        {responsibilities.map((r) => (
          <div
            key={r.code}
            className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
          >
            <span>
              <span className="font-medium text-slate-900">{r.code}</span> — {r.name}
            </span>
            {!readOnly && (
              <button
                onClick={() => handleRemove(r.code)}
                className="text-xs font-medium text-red-600 hover:underline"
              >
                Quitar
              </button>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="flex gap-2">
          <select
            value={codeToAdd}
            onChange={(e) => setCodeToAdd(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Seleccionar responsabilidad...</option>
            {availableCodes.map(([code, name]) => (
              <option key={code} value={code}>
                {code} — {name}
              </option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={!codeToAdd}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            Agregar
          </button>
        </div>
      )}
    </div>
  );
}
