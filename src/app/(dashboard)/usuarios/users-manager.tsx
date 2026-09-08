"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Company, Profile, UserCompanyAccess } from "@/lib/types";

export function UsersManager({
  profiles,
  companies,
  access,
}: {
  profiles: Profile[];
  companies: Company[];
  access: UserCompanyAccess[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const colaboradores = profiles.filter((p) => p.role === "colaborador");

  function companiesFor(userId: string) {
    const ids = new Set(access.filter((a) => a.user_id === userId).map((a) => a.company_id));
    return companies.filter((c) => ids.has(c.id));
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, full_name: fullName }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo invitar al colaborador.");
      return;
    }

    setEmail("");
    setFullName("");
    router.refresh();
  }

  async function handleRevokeUser(userId: string) {
    if (!confirm("¿Eliminar por completo el acceso de este colaborador?")) return;
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    router.refresh();
  }

  async function handleToggleCompany(userId: string, companyId: string, granted: boolean) {
    await fetch("/api/admin/access", {
      method: granted ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, company_id: companyId }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleInvite}
        className="rounded-2xl border border-slate-200 bg-white p-5"
      >
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Invitar colaborador</h2>
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            required
            placeholder="Nombre completo"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="flex-1 min-w-[180px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="email"
            required
            placeholder="correo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 min-w-[180px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Enviando..." : "Invitar"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <p className="mt-2 text-xs text-slate-500">
          Le llegará un correo para crear su contraseña. Después de invitarlo, asígnale
          empresas abajo.
        </p>
      </form>

      <div className="space-y-4">
        {colaboradores.length === 0 && (
          <p className="text-sm text-slate-500">Todavía no has invitado colaboradores.</p>
        )}
        {colaboradores.map((c) => {
          const assigned = companiesFor(c.id);
          const assignedIds = new Set(assigned.map((a) => a.id));
          return (
            <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{c.full_name}</p>
                  <p className="text-xs text-slate-500">Colaborador</p>
                </div>
                <button
                  onClick={() => handleRevokeUser(c.id)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Revocar acceso
                </button>
              </div>
              <p className="mb-2 text-xs font-medium text-slate-600">Empresas asignadas</p>
              <div className="flex flex-wrap gap-2">
                {companies.map((company) => {
                  const granted = assignedIds.has(company.id);
                  return (
                    <button
                      key={company.id}
                      onClick={() => handleToggleCompany(c.id, company.id, granted)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        granted
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-slate-300 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {company.razon_social}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
