import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { hasAnyFinancialModule } from "@/lib/financial/access";
import { RUBRO_BY_KEY } from "@/lib/financial/puc-mapping";

interface LineInput {
  account_code: string;
  account_name: string;
  saldo_anterior: number;
  debitos: number;
  creditos: number;
  saldo_final: number;
  rubro: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LINES = 10000;

// POST: guarda un balance de prueba ya revisado en el navegador
export async function POST(request: Request) {
  const { supabase, user } = await requireAdmin();

  if (!(await hasAnyFinancialModule(supabase))) {
    return NextResponse.json({ error: "Tu plan no incluye los módulos financieros." }, { status: 402 });
  }

  const body = (await request.json()) as {
    company_id?: string;
    period_start?: string;
    period_end?: string;
    source_file_name?: string;
    lines?: LineInput[];
  };

  if (!body.company_id || !ISO_DATE.test(body.period_start ?? "") || !ISO_DATE.test(body.period_end ?? "")) {
    return NextResponse.json({ error: "Falta la empresa o las fechas del periodo." }, { status: 400 });
  }
  if (!body.lines?.length || body.lines.length > MAX_LINES) {
    return NextResponse.json({ error: "El balance no tiene cuentas válidas." }, { status: 400 });
  }

  const lines = body.lines.map((l) => ({
    account_code: String(l.account_code).slice(0, 20),
    account_name: String(l.account_name ?? "").slice(0, 200),
    saldo_anterior: Number(l.saldo_anterior) || 0,
    debitos: Number(l.debitos) || 0,
    creditos: Number(l.creditos) || 0,
    saldo_final: Number(l.saldo_final) || 0,
    rubro: RUBRO_BY_KEY.has(l.rubro) ? l.rubro : "sin_clasificar",
  }));
  if (lines.some((l) => !/^\d+$/.test(l.account_code))) {
    return NextResponse.json({ error: "Hay códigos de cuenta no numéricos." }, { status: 400 });
  }

  // El marco técnico sale del grupo NIIF de la empresa (nunca del navegador)
  const { data: company } = await supabase
    .from("companies")
    .select("niif_grupo")
    .eq("id", body.company_id)
    .maybeSingle();
  if (!company) return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404 });
  if (!company.niif_grupo) {
    return NextResponse.json(
      { error: "Primero indica a qué grupo NIIF pertenece la empresa." },
      { status: 400 }
    );
  }

  // Reemplaza el balance del mismo cierre si ya existía (volver a subirlo corregido)
  await supabase
    .from("trial_balances")
    .delete()
    .eq("company_id", body.company_id)
    .eq("period_end", body.period_end);

  const { data: tb, error } = await supabase
    .from("trial_balances")
    .insert({
      company_id: body.company_id,
      period_start: body.period_start,
      period_end: body.period_end,
      framework: company.niif_grupo,
      source_file_name: body.source_file_name?.slice(0, 200) ?? null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  for (let i = 0; i < lines.length; i += 1000) {
    const { error: linesError } = await supabase
      .from("trial_balance_lines")
      .insert(lines.slice(i, i + 1000).map((l) => ({ ...l, trial_balance_id: tb.id })));
    if (linesError) {
      await supabase.from("trial_balances").delete().eq("id", tb.id);
      return NextResponse.json({ error: linesError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ trial_balance: tb });
}
