import { NextResponse } from "next/server";
import { hasModule, requireAdmin } from "@/lib/auth";
import { loadTrialBalanceLines } from "@/lib/audit/load";
import { computeMateriality, generatePlan, materialityBaseAmount, MATERIALITY_BASES, type MaterialityBase } from "@/lib/audit/planning";
import { balanceSheet, incomeStatement } from "@/lib/financial/statements";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// POST: crea un encargo de revisoría fiscal; con balance de prueba calcula la
// materialidad y propone la matriz de riesgos y los papeles de trabajo.
export async function POST(request: Request) {
  const { supabase, user } = await requireAdmin();
  if (!(await hasModule(supabase, "revisoria"))) {
    return NextResponse.json({ error: "Tu plan no incluye el módulo de revisoría fiscal." }, { status: 402 });
  }
  const b = await request.json();
  if (!b.company_id || !ISO.test(b.period_end ?? "")) {
    return NextResponse.json({ error: "Falta la empresa o la fecha de cierre." }, { status: 400 });
  }
  const { data: company } = await supabase.from("companies").select("tiene_revisor_fiscal").eq("id", b.company_id).maybeSingle();
  if (!company) return NextResponse.json({ error: "Empresa no encontrada." }, { status: 404 });
  if (!company.tiene_revisor_fiscal) {
    return NextResponse.json(
      { error: "La empresa no tiene revisor fiscal. Márcalo en su ficha si está obligada o lo tiene por estatutos." },
      { status: 400 }
    );
  }
  const base = (b.materialidad_base in MATERIALITY_BASES ? b.materialidad_base : "activos") as MaterialityBase;
  const porcentaje = Math.min(20, Math.max(0.1, Number(b.materialidad_porcentaje) || MATERIALITY_BASES[base].porcentaje));

  let materiality = { global: 0, ejecucion: 0, trivial: 0 };
  let plan: ReturnType<typeof generatePlan> = { risks: [], workpapers: [] };
  if (b.trial_balance_id) {
    const { data: tb } = await supabase.from("trial_balances").select("id, company_id").eq("id", b.trial_balance_id).maybeSingle();
    if (!tb || tb.company_id !== b.company_id) {
      return NextResponse.json({ error: "El balance de prueba no corresponde a la empresa." }, { status: 400 });
    }
    const lines = await loadTrialBalanceLines(supabase, tb.id);
    materiality = computeMateriality(materialityBaseAmount(base, balanceSheet(lines), incomeStatement(lines)), porcentaje);
    plan = generatePlan(lines, materiality.ejecucion);
  } else {
    plan = generatePlan([], 0);
  }

  const { data: eng, error } = await supabase
    .from("audit_engagements")
    .insert({
      company_id: b.company_id,
      trial_balance_id: b.trial_balance_id || null,
      period_end: b.period_end,
      materialidad_base: base,
      materialidad_porcentaje: porcentaje,
      materialidad_global: materiality.global,
      materialidad_ejecucion: materiality.ejecucion,
      umbral_trivial: materiality.trivial,
      revisor_nombre: b.revisor_nombre || null,
      revisor_tp: b.revisor_tp || null,
      ciudad: b.ciudad || null,
      created_by: user.id,
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ya existe un encargo de esta empresa para esa fecha de cierre." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const [r1, r2] = await Promise.all([
    supabase.from("audit_risks").insert(plan.risks.map((r, i) => ({ ...r, engagement_id: eng.id, sort: i }))),
    supabase.from("audit_workpapers").insert(plan.workpapers.map((w, i) => ({ ...w, engagement_id: eng.id, sort: i }))),
  ]);
  if (r1.error || r2.error) {
    await supabase.from("audit_engagements").delete().eq("id", eng.id);
    return NextResponse.json({ error: (r1.error ?? r2.error)!.message }, { status: 400 });
  }
  return NextResponse.json({ engagement: eng });
}
