import { requireAdmin } from "@/lib/auth";
import { processWompiTransaction, wompiConfigured } from "@/lib/billing/wompi";
import { formatCop, isActiveUntil } from "@/lib/billing/modules";
import type { OrganizationSubscription, Payment, ServiceModule } from "@/lib/types";
import { BuyModule } from "./buy-module";

const STATUS_LABEL: Record<string, string> = {
  APPROVED: "Aprobado",
  PENDING: "Pendiente",
  DECLINED: "Rechazado",
  VOIDED: "Anulado",
  ERROR: "Error",
  MANUAL: "Activación manual",
};

export default async function FacturacionPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { supabase, profile } = await requireAdmin();
  const { id: transactionId } = await searchParams;

  // Regreso desde el checkout de Wompi: se confirma el pago consultando a Wompi
  let paymentResult: string | null = null;
  if (transactionId && wompiConfigured()) {
    const result = await processWompiTransaction(transactionId);
    paymentResult = result.ok ? (result.status ?? null) : "ERROR";
  }

  const [{ data: modules }, { data: subs }, { data: payments }] = await Promise.all([
    supabase.from("service_modules").select("*").eq("active", true).order("sort_order"),
    supabase.from("organization_subscriptions").select("*").eq("organization_id", profile.organization_id ?? ""),
    supabase
      .from("payments")
      .select("*")
      .eq("organization_id", profile.organization_id ?? "")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const subByModule = new Map(((subs ?? []) as OrganizationSubscription[]).map((s) => [s.module_code, s]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-1 text-lg font-semibold text-slate-900">Plan y pagos</h1>
        <p className="text-sm text-slate-500">
          Activa solo los módulos que necesitas. Pagas por PSE, Nequi, tarjeta o Bancolombia a través
          de Wompi. Los precios incluyen IVA.
        </p>
      </div>

      {paymentResult && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            paymentResult === "APPROVED"
              ? "border-green-200 bg-green-50 text-green-800"
              : paymentResult === "PENDING"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {paymentResult === "APPROVED"
            ? "¡Pago aprobado! El módulo ya quedó activo."
            : paymentResult === "PENDING"
              ? "Tu pago está en proceso. El módulo se activa automáticamente cuando Wompi lo confirme."
              : "El pago no fue aprobado. Puedes intentarlo de nuevo."}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {((modules ?? []) as ServiceModule[]).map((m) => {
          const sub = subByModule.get(m.code);
          const until = sub ? new Date(sub.active_until) : null;
          const active = isActiveUntil(sub?.active_until);
          return (
            <div key={m.code} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-2 flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">{m.name}</p>
                <span
                  className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {active ? `Activo hasta ${until!.toLocaleDateString("es-CO")}` : "Inactivo"}
                </span>
              </div>
              <p className="mb-4 flex-1 text-sm text-slate-500">{m.description}</p>
              <p className="mb-3 text-lg font-semibold text-slate-900">
                {formatCop(m.price_cop)} <span className="text-xs font-normal text-slate-500">/ mes</span>
              </p>
              {profile.is_platform_owner ? (
                <p className="text-xs text-slate-500">Como dueño de la plataforma tienes todo activo.</p>
              ) : (
                <BuyModule moduleCode={m.code} monthlyPrice={m.price_cop} renew={active} />
              )}
            </div>
          );
        })}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Historial de pagos</h2>
        {(payments ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no hay pagos.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2">Fecha</th>
                  <th className="px-4 py-2">Módulo</th>
                  <th className="px-4 py-2">Meses</th>
                  <th className="px-4 py-2">Valor</th>
                  <th className="px-4 py-2">Estado</th>
                  <th className="px-4 py-2">Referencia</th>
                </tr>
              </thead>
              <tbody>
                {((payments ?? []) as Payment[]).map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">{new Date(p.created_at).toLocaleDateString("es-CO")}</td>
                    <td className="px-4 py-2">
                      {((modules ?? []) as ServiceModule[]).find((m) => m.code === p.module_code)?.name ?? p.module_code}
                    </td>
                    <td className="px-4 py-2">{p.months}</td>
                    <td className="px-4 py-2">{formatCop(p.amount_in_cents / 100)}</td>
                    <td className="px-4 py-2">{STATUS_LABEL[p.status] ?? p.status}</td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">{p.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
