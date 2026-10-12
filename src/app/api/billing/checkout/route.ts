import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildCheckoutUrl, wompiConfigured } from "@/lib/billing/wompi";
import { periodPrice } from "@/lib/billing/modules";
import type { ServiceModule } from "@/lib/types";

// POST: crea un pago pendiente y devuelve la URL del checkout de Wompi
export async function POST(request: Request) {
  const { supabase, user, profile } = await requireAdmin();

  if (!profile.organization_id) {
    return NextResponse.json({ error: "Tu usuario no pertenece a ningún despacho." }, { status: 400 });
  }
  if (!wompiConfigured()) {
    return NextResponse.json(
      { error: "Los pagos en línea todavía no están configurados. Contacta al proveedor." },
      { status: 503 }
    );
  }

  const { module_code, months } = (await request.json()) as { module_code?: string; months?: number };

  const { data: mod } = await supabase
    .from("service_modules")
    .select("*")
    .eq("code", module_code ?? "")
    .eq("active", true)
    .maybeSingle<ServiceModule>();

  if (!mod) return NextResponse.json({ error: "Módulo no válido." }, { status: 400 });

  let amountCop: number;
  try {
    amountCop = periodPrice(mod.price_cop, Number(months));
  } catch {
    return NextResponse.json({ error: "Periodo de pago no válido." }, { status: 400 });
  }

  const reference = `VT-${Date.now()}-${randomBytes(4).toString("hex")}`;
  const amountInCents = amountCop * 100;

  // Los pagos solo se escriben desde el servidor (no hay política de insert)
  const admin = createAdminClient();
  const { error } = await admin.from("payments").insert({
    organization_id: profile.organization_id,
    module_code: mod.code,
    months: Number(months),
    reference,
    amount_in_cents: amountInCents,
    created_by: user.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const origin = new URL(request.url).origin;
  const checkoutUrl = buildCheckoutUrl({
    reference,
    amountInCents,
    redirectUrl: `${origin}/facturacion`,
    customerEmail: user.email,
  });

  return NextResponse.json({ checkout_url: checkoutUrl });
}
