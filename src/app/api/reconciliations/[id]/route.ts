import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { loadMovements } from "@/lib/ledger/load";
import { autoMatch, type Match } from "@/lib/ledger/reconcile";

const cents = (n: number) => Math.round(n * 100);

// PATCH: ajustes del contador sobre la conciliación
//  { action: "match", bank: [ids], ledger: [ids] }  -> concilia manualmente (las sumas deben ser iguales)
//  { action: "unmatch", index }                     -> deshace un emparejamiento
//  { action: "rerun" }                              -> vuelve a emparejar automáticamente (conserva los manuales)
//  { saldo_extracto?, saldo_libros?, notes? }        -> datos generales
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  const body = await request.json();

  const { data: rec } = await supabase.from("bank_reconciliations").select("*").eq("id", id).maybeSingle();
  if (!rec) return NextResponse.json({ error: "Conciliación no encontrada." }, { status: 404 });
  let matches = (rec.matches ?? []) as Match[];
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.action === "match" || body.action === "rerun") {
    const [bank, ledger] = await Promise.all([
      loadMovements(supabase, rec.bank_import_id),
      loadMovements(supabase, rec.ledger_import_id, rec.cuenta_contable),
    ]);
    const used = new Set(matches.flatMap((m) => [...m.bank, ...m.ledger]));

    if (body.action === "match") {
      const bankIds: string[] = Array.isArray(body.bank) ? body.bank : [];
      const ledgerIds: string[] = Array.isArray(body.ledger) ? body.ledger : [];
      const bankSel = bank.filter((m) => bankIds.includes(m.id));
      const ledgerSel = ledger.filter((m) => ledgerIds.includes(m.id));
      if (bankSel.length !== bankIds.length || ledgerSel.length !== ledgerIds.length || bankSel.length + ledgerSel.length < 2) {
        return NextResponse.json({ error: "Selecciona partidas del extracto y del auxiliar." }, { status: 400 });
      }
      if ([...bankIds, ...ledgerIds].some((x) => used.has(x))) {
        return NextResponse.json({ error: "Alguna partida ya está conciliada." }, { status: 400 });
      }
      const diff = cents(bankSel.reduce((s, m) => s + m.valor, 0)) - cents(ledgerSel.reduce((s, m) => s + m.valor, 0));
      if (diff !== 0) {
        return NextResponse.json({ error: `Las sumas no coinciden (diferencia ${(diff / 100).toLocaleString("es-CO")}).` }, { status: 400 });
      }
      matches = [...matches, { bank: bankIds, ledger: ledgerIds, type: "manual" }];
    } else {
      const manual = matches.filter((m) => m.type === "manual");
      const manualIds = new Set(manual.flatMap((m) => [...m.bank, ...m.ledger]));
      matches = [
        ...manual,
        ...autoMatch(
          bank.filter((m) => !manualIds.has(m.id)),
          ledger.filter((m) => !manualIds.has(m.id)),
          rec.tolerance_days
        ),
      ];
    }
    update.matches = matches;
  } else if (body.action === "unmatch") {
    const index = Number(body.index);
    if (!Number.isInteger(index) || index < 0 || index >= matches.length) {
      return NextResponse.json({ error: "Emparejamiento no válido." }, { status: 400 });
    }
    update.matches = matches.filter((_, i) => i !== index);
  }
  if (body.saldo_extracto !== undefined) update.saldo_extracto = Number(body.saldo_extracto) || 0;
  if (body.saldo_libros !== undefined) update.saldo_libros = Number(body.saldo_libros) || 0;
  if (body.notes !== undefined) update.notes = String(body.notes).slice(0, 5000);

  const { error } = await supabase.from("bank_reconciliations").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  const { error } = await supabase.from("bank_reconciliations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
