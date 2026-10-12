import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { canUseLedgerTools } from "@/lib/ledger/access";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX = 50000;
const str = (v: unknown, n: number) => String(v ?? "").slice(0, n);
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : 0);

// POST: guarda un extracto o auxiliar ya revisado en el navegador
export async function POST(request: Request) {
  const { supabase, user } = await requireAdmin();
  if (!(await canUseLedgerTools(supabase))) {
    return NextResponse.json({ error: "Tu plan no incluye conciliaciones ni revisoría fiscal." }, { status: 402 });
  }

  const body = await request.json();
  if (!body.company_id || !["extracto", "auxiliar"].includes(body.kind) || !String(body.label ?? "").trim()) {
    return NextResponse.json({ error: "Falta la empresa, el tipo o el nombre." }, { status: 400 });
  }
  const movements = Array.isArray(body.movements) ? body.movements : [];
  if (movements.length === 0 || movements.length > MAX) {
    return NextResponse.json({ error: `El archivo debe tener entre 1 y ${MAX} movimientos.` }, { status: 400 });
  }
  const rows = movements
    .filter((m: Record<string, unknown>) => ISO.test(String(m.fecha)))
    .map((m: Record<string, unknown>, i: number) => ({
      row_number: Number(m.row) || i + 1,
      fecha: String(m.fecha),
      descripcion: str(m.descripcion, 300),
      documento: str(m.documento, 80),
      tercero: str(m.tercero, 200),
      nit: str(m.nit, 30),
      cuenta: str(m.cuenta, 20),
      cuenta_nombre: str(m.cuenta_nombre, 200),
      debito: Math.abs(num(m.debito)),
      credito: Math.abs(num(m.credito)),
      saldo: m.saldo === null || m.saldo === undefined ? null : num(m.saldo),
      valor: num(m.valor),
    }));
  const fechas = rows.map((r: { fecha: string }) => r.fecha).sort();

  const { data: imp, error } = await supabase
    .from("ledger_imports")
    .insert({
      company_id: body.company_id,
      kind: body.kind,
      label: str(body.label, 120).trim(),
      period_start: ISO.test(body.period_start) ? body.period_start : fechas[0],
      period_end: ISO.test(body.period_end) ? body.period_end : fechas[fechas.length - 1],
      source_file_name: body.source_file_name ? str(body.source_file_name, 200) : null,
      method: ["reglas", "ia", "manual"].includes(body.method) ? body.method : "reglas",
      mapping: body.mapping ?? null,
      movement_count: rows.length,
      saldo_inicial: body.saldo_inicial === null || body.saldo_inicial === undefined || body.saldo_inicial === "" ? null : num(body.saldo_inicial),
      saldo_final: body.saldo_final === null || body.saldo_final === undefined || body.saldo_final === "" ? null : num(body.saldo_final),
      created_by: user.id,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  for (let i = 0; i < rows.length; i += 1000) {
    const { error: e } = await supabase
      .from("ledger_movements")
      .insert(rows.slice(i, i + 1000).map((r: object) => ({ ...r, import_id: imp.id })));
    if (e) {
      await supabase.from("ledger_imports").delete().eq("id", imp.id);
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  }
  return NextResponse.json({ import: imp });
}
