import { NextResponse } from "next/server";
import { hasModule, requireAdmin } from "@/lib/auth";
import { loadMovements } from "@/lib/ledger/load";
import { autoMatch } from "@/lib/ledger/reconcile";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// POST: crea una conciliación bancaria y ejecuta el emparejamiento automático
export async function POST(request: Request) {
  const { supabase, user } = await requireAdmin();
  if (!(await hasModule(supabase, "conciliaciones"))) {
    return NextResponse.json({ error: "Tu plan no incluye el módulo de conciliaciones." }, { status: 402 });
  }
  const b = await request.json();
  if (!b.company_id || !b.bank_import_id || !b.ledger_import_id || !ISO.test(b.period_end ?? "") || !String(b.cuenta_label ?? "").trim()) {
    return NextResponse.json({ error: "Faltan datos de la conciliación." }, { status: 400 });
  }
  const tolerance = Math.min(31, Math.max(0, Number(b.tolerance_days ?? 5) || 0));
  const cuenta = String(b.cuenta_contable ?? "").replace(/\D/g, "") || null;

  const [{ data: imports }, bank, ledger] = await Promise.all([
    supabase.from("ledger_imports").select("id, kind, company_id").in("id", [b.bank_import_id, b.ledger_import_id]),
    loadMovements(supabase, b.bank_import_id),
    loadMovements(supabase, b.ledger_import_id, cuenta),
  ]);
  const bankImp = imports?.find((i) => i.id === b.bank_import_id);
  const ledgerImp = imports?.find((i) => i.id === b.ledger_import_id);
  if (bankImp?.kind !== "extracto" || ledgerImp?.kind !== "auxiliar" || bankImp.company_id !== b.company_id || ledgerImp.company_id !== b.company_id) {
    return NextResponse.json({ error: "Elige un extracto y un auxiliar de la misma empresa." }, { status: 400 });
  }
  if (ledger.length === 0) {
    return NextResponse.json({ error: "El auxiliar no tiene movimientos para esa cuenta contable." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("bank_reconciliations")
    .insert({
      company_id: b.company_id,
      cuenta_label: String(b.cuenta_label).trim().slice(0, 120),
      cuenta_contable: cuenta,
      period_end: b.period_end,
      bank_import_id: b.bank_import_id,
      ledger_import_id: b.ledger_import_id,
      saldo_extracto: Number(b.saldo_extracto) || 0,
      saldo_libros: Number(b.saldo_libros) || 0,
      tolerance_days: tolerance,
      matches: autoMatch(bank, ledger, tolerance),
      created_by: user.id,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ reconciliation: data });
}
