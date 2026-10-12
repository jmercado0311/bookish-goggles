import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requirePlatformOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// POST: activación manual de un módulo (pago por transferencia, cortesía, etc.)
export async function POST(request: Request) {
  const { user } = await requirePlatformOwner();
  const { organization_id, module_code, months, amount_cop } = (await request.json()) as {
    organization_id?: string;
    module_code?: string;
    months?: number;
    amount_cop?: number;
  };

  const m = Number(months);
  if (!organization_id || !module_code || !Number.isInteger(m) || m < 1 || m > 12) {
    return NextResponse.json({ error: "Datos incompletos (meses entre 1 y 12)." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: payError } = await admin.from("payments").insert({
    organization_id,
    module_code,
    months: m,
    reference: `MANUAL-${Date.now()}-${randomBytes(3).toString("hex")}`,
    amount_in_cents: Math.max(0, Math.round(Number(amount_cop) || 0)) * 100,
    status: "MANUAL",
    provider: "manual",
    created_by: user.id,
    processed_at: new Date().toISOString(),
  });
  if (payError) return NextResponse.json({ error: payError.message }, { status: 400 });

  const { data, error } = await admin.rpc("extend_subscription", {
    org: organization_id,
    module: module_code,
    months: m,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ active_until: data });
}
