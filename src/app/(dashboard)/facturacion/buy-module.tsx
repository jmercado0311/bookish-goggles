"use client";

import { useState } from "react";
import { BILLING_PERIODS, formatCop, periodPrice } from "@/lib/billing/modules";

export function BuyModule({
  moduleCode,
  monthlyPrice,
  renew,
}: {
  moduleCode: string;
  monthlyPrice: number;
  renew: boolean;
}) {
  const [months, setMonths] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy() {
    setError(null);
    setLoading(true);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module_code: moduleCode, months }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.checkout_url) {
      setLoading(false);
      setError(body.error ?? "No se pudo iniciar el pago.");
      return;
    }
    window.location.href = body.checkout_url;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
          className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
        >
          {BILLING_PERIODS.map((p) => (
            <option key={p.months} value={p.months}>
              {p.label} · {formatCop(periodPrice(monthlyPrice, p.months))}
            </option>
          ))}
        </select>
        <button
          onClick={handleBuy}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Redirigiendo..." : renew ? "Renovar" : "Activar"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
