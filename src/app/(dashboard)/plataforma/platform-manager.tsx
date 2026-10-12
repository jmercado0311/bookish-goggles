"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isActiveUntil } from "@/lib/billing/modules";
import type { Organization, OrganizationSubscription, ServiceModule } from "@/lib/types";

type OrgRow = Organization & { users: number; companies: number };

export function PlatformManager({
  organizations,
  modules,
  subscriptions,
}: {
  organizations: OrgRow[];
  modules: ServiceModule[];
  subscriptions: OrganizationSubscription[];
}) {
  const router = useRouter();
  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries(modules.map((m) => [m.code, String(m.price_cop)]))
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function savePrice(code: string) {
    setBusy(`price-${code}`);
    const res = await fetch("/api/platform/modules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, price_cop: Number(prices[code]) }),
    });
    setBusy(null);
    setMessage(res.ok ? "Precio actualizado." : "No se pudo actualizar el precio.");
    router.refresh();
  }

  async function activate(orgId: string, moduleCode: string) {
    const months = prompt("¿Cuántos meses activar? (1 a 12)", "1");
    if (!months) return;
    const amount = prompt("Valor recibido en pesos (0 si es cortesía)", "0");
    if (amount === null) return;
    setBusy(`${orgId}-${moduleCode}`);
    const res = await fetch("/api/platform/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organization_id: orgId,
        module_code: moduleCode,
        months: Number(months),
        amount_cop: Number(amount),
      }),
    });
    setBusy(null);
    const body = await res.json().catch(() => ({}));
    setMessage(res.ok ? "Módulo activado." : (body.error ?? "No se pudo activar."));
    router.refresh();
  }

  const subFor = (orgId: string, code: string) =>
    subscriptions.find((s) => s.organization_id === orgId && s.module_code === code);

  const filtered = organizations.filter((o) =>
    `${o.name} ${o.nit ?? ""} ${o.contact_email ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {message && <p className="text-sm text-slate-600">{message}</p>}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Precios mensuales (IVA incluido)</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {modules.map((m) => (
            <div key={m.code} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
              <span className="flex-1 text-sm text-slate-700">{m.name}</span>
              <input
                type="number"
                min={0}
                step={100}
                value={prices[m.code]}
                onChange={(e) => setPrices({ ...prices, [m.code]: e.target.value })}
                className="w-32 rounded-lg border border-slate-300 px-2 py-1.5 text-right text-sm"
              />
              <button
                onClick={() => savePrice(m.code)}
                disabled={busy === `price-${m.code}`}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Guardar
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Despachos ({organizations.length})</h2>
          <input
            type="search"
            placeholder="Buscar por nombre, NIT o correo"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div className="space-y-3">
          {filtered.map((o) => (
            <div key={o.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{o.name}</p>
                  <p className="text-xs text-slate-500">
                    {o.nit ? `NIT ${o.nit} · ` : ""}
                    {o.contact_email ?? "sin correo"} · {o.users} usuario(s) · {o.companies} empresa(s) ·
                    desde {new Date(o.created_at).toLocaleDateString("es-CO")}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {modules.map((m) => {
                  const sub = subFor(o.id, m.code);
                  const active = isActiveUntil(sub?.active_until);
                  return (
                    <button
                      key={m.code}
                      onClick={() => activate(o.id, m.code)}
                      disabled={busy === `${o.id}-${m.code}`}
                      title="Activar o extender manualmente"
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        active
                          ? "border-green-300 bg-green-50 text-green-700"
                          : "border-slate-300 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {m.name}
                      {sub ? ` · hasta ${new Date(sub.active_until).toLocaleDateString("es-CO")}` : " · sin activar"}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
