import { hasModule, requireUser } from "@/lib/auth";
import { Paywall } from "../paywall";
import type {
  Company,
  CompanyIca,
  CompanyResponsibility,
  CustomObligation,
  IcaCalendarEntry,
  SubmittedDeclaration,
  TaxCalendarEntry,
} from "@/lib/types";
import { fetchAllByYears } from "@/lib/supabase/fetch-all";
import { computeCompanyDeadlines } from "@/lib/tax-rules/compute-deadlines";
import { DeadlinesView } from "./deadlines-view";

export default async function VencimientosPage() {
  const { supabase, profile } = await requireUser();
  if (!(await hasModule(supabase, "vencimientos"))) {
    return <Paywall moduleName="Vencimientos tributarios" isAdmin={profile.role === "admin"} />;
  }
  const year = new Date().getFullYear();
  // Año actual + el siguiente: los vencimientos "hasta enero" del año que
  // viene ya quedan visibles sin esperar el cambio de año, y sin necesidad
  // de borrar el calendario del año en curso cuando llegue el próximo.
  const years = [year, year + 1];

  const [
    { data: companies },
    { data: responsibilities },
    { data: icas },
    { data: customObligations },
    { data: taxCalendar },
    { data: submitted },
    icaCalendar,
  ] = await Promise.all([
    supabase.from("companies").select("*").order("razon_social"),
    supabase.from("company_responsibilities").select("*"),
    supabase.from("company_ica").select("*"),
    supabase.from("custom_obligations").select("*"),
    supabase.from("tax_calendar").select("*").in("year", years),
    supabase.from("submitted_declarations").select("*"),
    fetchAllByYears<IcaCalendarEntry>(supabase, "ica_calendar", years),
  ]);

  const responsibilitiesByCompany = new Map<string, CompanyResponsibility[]>();
  for (const r of (responsibilities ?? []) as CompanyResponsibility[]) {
    if (!responsibilitiesByCompany.has(r.company_id)) responsibilitiesByCompany.set(r.company_id, []);
    responsibilitiesByCompany.get(r.company_id)!.push(r);
  }

  const icaByCompany = new Map<string, CompanyIca[]>();
  for (const i of (icas ?? []) as CompanyIca[]) {
    icaByCompany.set(i.company_id, [...(icaByCompany.get(i.company_id) ?? []), i]);
  }

  const customByCompany = new Map<string, CustomObligation[]>();
  for (const c of (customObligations ?? []) as CustomObligation[]) {
    if (!customByCompany.has(c.company_id)) customByCompany.set(c.company_id, []);
    customByCompany.get(c.company_id)!.push(c);
  }

  const deadlines = computeCompanyDeadlines({
    companies: (companies ?? []) as Company[],
    responsibilitiesByCompany,
    icaByCompany,
    customObligationsByCompany: customByCompany,
    taxCalendar: (taxCalendar ?? []) as TaxCalendarEntry[],
    icaCalendar,
    submittedDeclarations: (submitted ?? []) as SubmittedDeclaration[],
    years,
  });

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Vencimientos</h1>
      <p className="mb-6 text-sm text-slate-500">
        Cruce de responsabilidades tributarias × calendario {year}–{year + 1} para tus empresas.
      </p>
      <DeadlinesView
        deadlines={deadlines}
        companies={(companies ?? []) as Company[]}
        canMarkPresentada={profile.role === "admin"}
      />
    </div>
  );
}
