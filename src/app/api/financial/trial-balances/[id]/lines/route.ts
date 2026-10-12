import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { RUBRO_BY_KEY } from "@/lib/financial/puc-mapping";

// PATCH: reclasifica una cuenta a otro rubro NIIF
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  const { account_code, rubro } = (await request.json()) as { account_code?: string; rubro?: string };

  if (!account_code || !rubro || !RUBRO_BY_KEY.has(rubro)) {
    return NextResponse.json({ error: "Cuenta o rubro no válido." }, { status: 400 });
  }

  const { error } = await supabase
    .from("trial_balance_lines")
    .update({ rubro })
    .eq("trial_balance_id", id)
    .eq("account_code", account_code);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
