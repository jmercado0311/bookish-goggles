import Link from "next/link";
import { notFound } from "next/navigation";
import { hasModule, requireUser } from "@/lib/auth";
import type { createClient } from "@/lib/supabase/server";
import type { Company, Organization } from "@/lib/types";
import {
  balanceSheet,
  cashFlow,
  equityChanges,
  incomeStatement,
  incomeStatementLines,
  type TBLine,
} from "@/lib/financial/statements";
import { computeIndicators } from "@/lib/financial/indicators";
import { buildNotes, type Framework } from "@/lib/financial/notes";
import { Paywall } from "../../paywall";
import type { ReportInfo } from "./report-header";
import { StatementsView } from "./statements-view";
import { IndicatorsView } from "./indicators-view";
import { NotesView } from "./notes-view";
import { ClassificationView } from "./classification-view";
import { ReportSettings } from "./report-settings";
import { Signatures } from "./signatures";

type Supabase = Awaited<ReturnType<typeof createClient>>;

interface TrialBalance {
  id: string;
  company_id: string;
  period_start: string;
  period_end: string;
  framework: Framework;
  source_file_name: string | null;
  representante_legal: string | null;
  contador_nombre: string | null;
  contador_tp: string | null;
  revisor_fiscal_nombre: string | null;
  revisor_fiscal_tp: string | null;
}

/** Supabase devuelve máximo 1.000 filas por consulta: se pagina. */
async function loadLines(supabase: Supabase, trialBalanceId: string): Promise<TBLine[]> {
  const all: TBLine[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("trial_balance_lines")
      .select("account_code, account_name, saldo_anterior, saldo_final, rubro")
      .eq("trial_balance_id", trialBalanceId)
      .order("account_code")
      .range(from, from + 999);
    const page = (data ?? []).map((l) => ({
      ...l,
      saldo_anterior: Number(l.saldo_anterior),
      saldo_final: Number(l.saldo_final),
    })) as TBLine[];
    all.push(...page);
    if (page.length < 1000) return all;
  }
}

const TABS = [
  { key: "estados", label: "Estados financieros", module: "estados_financieros" },
  { key: "notas", label: "Notas", module: "notas" },
  { key: "indicadores", label: "Indicadores", module: "indicadores" },
  { key: "clasificacion", label: "Clasificación de cuentas", module: null },
] as const;

export default async function TrialBalancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vista?: string }>;
}) {
  const { id } = await params;
  const { vista } = await searchParams;
  const { supabase, profile } = await requireUser();
  const isAdmin = profile.role === "admin";

  const { data: tb } = await supabase.from("trial_balances").select("*").eq("id", id).maybeSingle<TrialBalance>();
  if (!tb) notFound();

  const [{ data: company }, { data: org }, { data: comparative }, { data: noteRows }, modEstados, modNotas, modIndicadores] =
    await Promise.all([
      supabase.from("companies").select("*").eq("id", tb.company_id).single<Company>(),
      supabase.from("organizations").select("*").eq("id", profile.organization_id ?? "").maybeSingle<Organization>(),
      // Comparativo del estado de resultados: el balance más reciente anterior a este periodo
      supabase
        .from("trial_balances")
        .select("id, period_start, period_end")
        .eq("company_id", tb.company_id)
        .lt("period_end", tb.period_start)
        .order("period_end", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("financial_notes").select("note_key, content").eq("trial_balance_id", id),
      hasModule(supabase, "estados_financieros"),
      hasModule(supabase, "notas"),
      hasModule(supabase, "indicadores"),
    ]);
  if (!company) notFound();

  const enabled: Record<string, boolean> = {
    estados_financieros: modEstados,
    notas: modNotas,
    indicadores: modIndicadores,
  };
  const tab = TABS.find((t) => t.key === vista) ?? TABS[0];

  const lines = await loadLines(supabase, id);
  const prevLines = comparative ? await loadLines(supabase, comparative.id) : null;

  const income = incomeStatement(lines);
  const incomePrev = prevLines ? incomeStatement(prevLines) : null;
  const bs = balanceSheet(lines);

  const info: ReportInfo = {
    razonSocial: company.razon_social,
    nit: `${company.nit}${company.dv ? `-${company.dv}` : ""}`,
    periodStart: tb.period_start,
    periodEnd: tb.period_end,
    previousPeriodEnd: comparative?.period_end ?? null,
  };

  const signatures = (
    <Signatures
      representanteLegal={tb.representante_legal}
      contadorNombre={tb.contador_nombre}
      contadorTp={tb.contador_tp}
      revisorNombre={tb.revisor_fiscal_nombre}
      revisorTp={tb.revisor_fiscal_tp}
    />
  );

  let content: React.ReactNode;
  if (tab.module && !enabled[tab.module]) {
    content = <Paywall moduleName={tab.label} isAdmin={isAdmin} />;
  } else if (tab.key === "estados") {
    content = (
      <StatementsView
        info={info}
        balance={bs}
        incomeLines={incomeStatementLines(income, incomePrev)}
        incomeClosed={income.cerrado}
        equity={equityChanges(bs, income)}
        cash={cashFlow(lines, income, bs)}
        signatures={signatures}
      />
    );
  } else if (tab.key === "notas") {
    const overrides = Object.fromEntries((noteRows ?? []).map((n) => [n.note_key, n.content as string]));
    content = (
      <NotesView
        trialBalanceId={id}
        info={info}
        canEdit={isAdmin}
        notes={buildNotes(
          {
            razonSocial: company.razon_social,
            nit: info.nit,
            municipio: company.municipio,
            departamento: company.departamento,
            tipoContribuyente: company.tipo_contribuyente,
            periodStart: tb.period_start,
            periodEnd: tb.period_end,
            framework: tb.framework,
          },
          lines,
          overrides
        )}
        signatures={signatures}
      />
    );
  } else if (tab.key === "indicadores") {
    content = (
      <IndicatorsView
        info={info}
        indicators={computeIndicators({ bs: bs.current, bsPrev: bs.previous, income, incomePrev, lines })}
        hasPreviousIncome={incomePrev !== null}
      />
    );
  } else {
    content = <ClassificationView trialBalanceId={id} lines={lines} canEdit={isAdmin} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <Link href="/financieros" className="text-xs text-blue-600 hover:underline">
            ← Estados financieros
          </Link>
          <h1 className="text-lg font-semibold text-slate-900">{company.razon_social}</h1>
          <p className="text-sm text-slate-500">
            Balance de prueba del {tb.period_start} al {tb.period_end}
            {tb.source_file_name ? ` · ${tb.source_file_name}` : ""}
            {org ? ` · ${org.name}` : ""}
          </p>
        </div>
        {isAdmin && <ReportSettings trialBalance={tb} companyId={tb.company_id} />}
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 print:hidden">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/financieros/${id}?vista=${t.key}`}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
              t.key === tab.key
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
            {t.module && !enabled[t.module] ? " 🔒" : ""}
          </Link>
        ))}
      </nav>

      {bs.descuadre !== 0 && tab.key !== "clasificacion" && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 print:hidden">
          El estado de situación financiera no cuadra por {bs.descuadre.toLocaleString("es-CO")}. Revisa
          las cuentas sin clasificar o excluidas en la pestaña Clasificación de cuentas.
        </p>
      )}

      {content}
    </div>
  );
}
