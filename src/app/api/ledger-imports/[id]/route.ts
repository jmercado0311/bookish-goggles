import { NextResponse } from "next/server";
import { requireAdmin, requireUser } from "@/lib/auth";
import { loadMovements } from "@/lib/ledger/load";

// DELETE: elimina un extracto o auxiliar (y las conciliaciones que lo usan)
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  const { error } = await supabase.from("ledger_imports").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// GET: cuentas contenidas en un auxiliar (para elegir la cuenta de bancos a conciliar)
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireUser();
  const { id } = await params;
  const movements = await loadMovements(supabase, id);
  const accounts = new Map<string, { cuenta: string; nombre: string; movimientos: number; neto: number; ultimoSaldo: number | null }>();
  for (const m of movements) {
    const a = accounts.get(m.cuenta) ?? { cuenta: m.cuenta, nombre: m.cuenta_nombre, movimientos: 0, neto: 0, ultimoSaldo: null };
    a.movimientos++;
    a.neto = Math.round((a.neto + m.valor) * 100) / 100;
    if (m.saldo !== null) a.ultimoSaldo = m.saldo;
    if (!a.nombre && m.cuenta_nombre) a.nombre = m.cuenta_nombre;
    accounts.set(m.cuenta, a);
  }
  return NextResponse.json({ accounts: [...accounts.values()].sort((a, b) => a.cuenta.localeCompare(b.cuenta)) });
}
