import { requirePlatformOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCop, isActiveUntil, withinLastDays } from "@/lib/billing/modules";
import type { Organization, OrganizationSubscription, Payment, ServiceModule } from "@/lib/types";
import { PlatformManager } from "./platform-manager";

export default async function PlataformaPage() {
  await requirePlatformOwner();
  // Vista global de todos los despachos: se lee con la llave de servicio
  const admin = createAdminClient();

  const [{ data: orgs }, { data: modules }, { data: subs }, { data: payments }, { data: profiles }, { data: companies }] =
    await Promise.all([
      admin.from("organizations").select("*").order("created_at", { ascending: false }),
      admin.from("service_modules").select("*").order("sort_order"),
      admin.from("organization_subscriptions").select("*"),
      admin.from("payments").select("*").in("status", ["APPROVED", "MANUAL"]),
      admin.from("profiles").select("organization_id"),
      admin.from("companies").select("organization_id"),
    ]);

  const paid = (payments ?? []) as Payment[];
  const ingresosMes = paid
    .filter((p) => withinLastDays(p.created_at, 30))
    .reduce((s, p) => s + p.amount_in_cents / 100, 0);
  const ingresosTotal = paid.reduce((s, p) => s + p.amount_in_cents / 100, 0);
  const activeSubs = ((subs ?? []) as OrganizationSubscription[]).filter((s) => isActiveUntil(s.active_until));

  const count = (rows: { organization_id: string | null }[] | null, orgId: string) =>
    (rows ?? []).filter((r) => r.organization_id === orgId).length;

  const stats = [
    { label: "Despachos registrados", value: String((orgs ?? []).length) },
    { label: "Módulos activos", value: String(activeSubs.length) },
    { label: "Ingresos últimos 30 días", value: formatCop(ingresosMes) },
    { label: "Ingresos totales", value: formatCop(ingresosTotal) },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-1 text-lg font-semibold text-slate-900">Plataforma</h1>
        <p className="text-sm text-slate-500">
          Tus clientes (despachos), sus módulos y tus precios. Solo tú ves esta sección.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      <PlatformManager
        organizations={((orgs ?? []) as Organization[]).map((o) => ({
          ...o,
          users: count(profiles, o.id),
          companies: count(companies, o.id),
        }))}
        modules={(modules ?? []) as ServiceModule[]}
        subscriptions={(subs ?? []) as OrganizationSubscription[]}
      />
    </div>
  );
}
