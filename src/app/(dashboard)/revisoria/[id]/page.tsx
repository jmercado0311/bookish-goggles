import Link from "next/link";
import { notFound } from "next/navigation";
import { hasModule, requireUser } from "@/lib/auth";
import { loadTrialBalanceLines } from "@/lib/audit/load";
import { materialityBaseAmount, MATERIALITY_BASES, redFlags, type MaterialityBase } from "@/lib/audit/planning";
import { buildArt209, buildDictamen, buildRepresentationLetter, suggestOpinion, type Opinion, type ReportContext } from "@/lib/audit/report";
import { balanceSheet, incomeStatement } from "@/lib/financial/statements";
import { FRAMEWORKS, type Framework } from "@/lib/financial/frameworks";
import { Paywall } from "../../paywall";
import { DeleteButton } from "../../conciliaciones/delete-button";
import { DocumentView, FindingsView, PlanningView, RisksView, WorkpapersView, type Finding, type Risk, type Workpaper } from "./engagement-views";

const TABS = [
  { key: "planeacion", label: "Planeación" },
  { key: "riesgos", label: "Matriz de riesgos" },
  { key: "papeles", label: "Papeles de trabajo" },
  { key: "hallazgos", label: "Hallazgos" },
  { key: "dictamen", label: "Dictamen" },
  { key: "art209", label: "Informe art. 209" },
  { key: "carta", label: "Carta de representación" },
] as const;

export default async function EncargoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vista?: string }>;
}) {
  const { id } = await params;
  const { vista } = await searchParams;
  const { supabase, profile } = await requireUser();
  const canEdit = profile.role === "admin";
  if (!(await hasModule(supabase, "revisoria"))) return <Paywall moduleName="Revisoría fiscal" isAdmin={canEdit} />;

  const { data: eng } = await supabase.from("audit_engagements").select("*").eq("id", id).maybeSingle();
  if (!eng) notFound();

  const [{ data: company }, { data: risks }, { data: papers }, { data: findings }, { data: docs }] = await Promise.all([
    supabase.from("companies").select("razon_social, nit, dv, municipio, niif_grupo").eq("id", eng.company_id).single(),
    supabase.from("audit_risks").select("*").eq("engagement_id", id).order("sort"),
    supabase.from("audit_workpapers").select("*").eq("engagement_id", id).order("sort"),
    supabase.from("audit_findings").select("*").eq("engagement_id", id).order("created_at"),
    supabase.from("audit_documents").select("doc_key, content").eq("engagement_id", id),
  ]);
  if (!company) notFound();

  const lines = eng.trial_balance_id ? await loadTrialBalanceLines(supabase, eng.trial_balance_id) : [];
  const bs = balanceSheet(lines);
  const income = incomeStatement(lines);
  const baseAmounts = Object.fromEntries(
    (Object.keys(MATERIALITY_BASES) as MaterialityBase[]).map((b) => [b, lines.length ? materialityBaseAmount(b, bs, income) : 0])
  ) as Record<MaterialityBase, number>;
  const flags = lines.length ? redFlags(lines, Number(eng.materialidad_ejecucion)) : [];

  const findingList = (findings ?? []) as Finding[];
  const noCorregidas = findingList.filter((f) => f.tipo === "incorreccion" && !f.corregido).reduce((s, f) => s + Math.abs(Number(f.monto)), 0);
  const sugerida = suggestOpinion(noCorregidas, Number(eng.materialidad_global), eng.generalizado);
  const framework = (company.niif_grupo ?? "grupo2") as Framework;
  const overrides = Object.fromEntries((docs ?? []).map((d) => [d.doc_key, d.content as string]));

  const ctx: ReportContext = {
    razonSocial: company.razon_social,
    nit: `${company.nit}${company.dv ? `-${company.dv}` : ""}`,
    ciudad: eng.ciudad ?? company.municipio ?? "",
    periodEnd: eng.period_end,
    framework,
    revisorNombre: eng.revisor_nombre ?? "",
    revisorTp: eng.revisor_tp ?? "",
    firmaDesignante: eng.firma_designante,
    fechaInforme: eng.fecha_informe,
    opinion: eng.opinion as Opinion,
    fundamentoModificacion: findingList
      .filter((f) => f.tipo === "incorreccion" && !f.corregido)
      .map((f) => `${f.titulo}: ${f.condicion} Efecto: $${Math.round(Number(f.monto)).toLocaleString("es-CO")}. ${f.efecto}`.trim())
      .join("\n\n"),
    incorreccionesNoCorregidas: noCorregidas,
    materialidadGlobal: Number(eng.materialidad_global),
    deficienciasControl: findingList.filter((f) => f.tipo === "control_interno").map((f) => `${f.titulo}. ${f.recomendacion}`.trim()),
    incumplimientos: findingList.filter((f) => f.tipo === "incumplimiento_legal").map((f) => `${f.titulo}. ${f.condicion}`.trim()),
  };

  const tab = TABS.find((t) => t.key === vista) ?? TABS[0];
  let content: React.ReactNode;
  if (tab.key === "planeacion") {
    content = (
      <PlanningView
        engagement={eng}
        canEdit={canEdit}
        baseAmounts={baseAmounts}
        hasTrialBalance={lines.length > 0}
        flags={flags}
        noCorregidas={noCorregidas}
        sugerida={sugerida}
      />
    );
  } else if (tab.key === "riesgos") {
    content = <RisksView engagementId={id} risks={(risks ?? []) as Risk[]} canEdit={canEdit} />;
  } else if (tab.key === "papeles") {
    content = <WorkpapersView engagementId={id} papers={(papers ?? []) as Workpaper[]} canEdit={canEdit} />;
  } else if (tab.key === "hallazgos") {
    content = (
      <FindingsView
        engagementId={id}
        findings={findingList}
        canEdit={canEdit}
        refs={((papers ?? []) as Workpaper[]).map((p) => p.ref)}
        materialidad={Number(eng.materialidad_global)}
        trivial={Number(eng.umbral_trivial)}
      />
    );
  } else {
    const sections =
      tab.key === "dictamen" ? buildDictamen(ctx, overrides) : tab.key === "art209" ? buildArt209(ctx, overrides) : buildRepresentationLetter(ctx, overrides);
    content = (
      <DocumentView
        engagementId={id}
        title={tab.key === "dictamen" ? "Informe del revisor fiscal" : tab.label}
        sections={sections}
        canEdit={canEdit}
        opinionControl={tab.key === "dictamen" ? { opinion: eng.opinion as Opinion, sugerida, generalizado: eng.generalizado } : null}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <Link href="/revisoria" className="text-xs text-blue-600 hover:underline">
            ← Revisoría fiscal
          </Link>
          <h1 className="text-lg font-semibold text-slate-900">{company.razon_social}</h1>
          <p className="text-sm text-slate-500">
            Encargo al {eng.period_end} · {FRAMEWORKS[framework].short}
            {!eng.trial_balance_id && " · sin balance de prueba"}
          </p>
        </div>
        {canEdit && <DeleteButton url={`/api/audit/engagements/${id}`} confirmText="¿Eliminar este encargo con sus papeles de trabajo y hallazgos?" redirectTo="/revisoria" />}
      </div>
      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 print:hidden">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/revisoria/${id}?vista=${t.key}`}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
              t.key === tab.key ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {content}
    </div>
  );
}
