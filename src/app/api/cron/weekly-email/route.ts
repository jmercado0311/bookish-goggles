import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeCompanyDeadlines } from "@/lib/tax-rules/compute-deadlines";
import { isWithinWeek } from "@/lib/tax-rules/urgency";
import { currentMonday } from "@/lib/tax-rules/week";
import { buildWeeklyDigestHtml } from "@/lib/email/weekly-digest";
import { sendWeeklyDigestEmail } from "@/lib/email/send";
import type {
  Company,
  CompanyIca,
  CompanyResponsibility,
  CustomObligation,
  Profile,
  SubmittedDeclaration,
  TaxCalendarEntry,
  UserCompanyAccess,
} from "@/lib/types";

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const year = new Date().getFullYear();
  const years = [year, year + 1];
  const monday = currentMonday();

  const [
    { data: profiles },
    { data: companies },
    { data: responsibilities },
    { data: icas },
    { data: customObligations },
    { data: taxCalendar },
    { data: access },
    { data: submitted },
  ] = await Promise.all([
    admin.from("profiles").select("*"),
    admin.from("companies").select("*"),
    admin.from("company_responsibilities").select("*"),
    admin.from("company_ica").select("*"),
    admin.from("custom_obligations").select("*"),
    admin.from("tax_calendar").select("*").in("year", years),
    admin.from("user_company_access").select("*"),
    admin.from("submitted_declarations").select("*"),
  ]);

  const responsibilitiesByCompany = new Map<string, CompanyResponsibility[]>();
  for (const r of (responsibilities ?? []) as CompanyResponsibility[]) {
    if (!responsibilitiesByCompany.has(r.company_id)) responsibilitiesByCompany.set(r.company_id, []);
    responsibilitiesByCompany.get(r.company_id)!.push(r);
  }
  const icaByCompany = new Map<string, CompanyIca>();
  for (const i of (icas ?? []) as CompanyIca[]) icaByCompany.set(i.company_id, i);
  const customByCompany = new Map<string, CustomObligation[]>();
  for (const c of (customObligations ?? []) as CustomObligation[]) {
    if (!customByCompany.has(c.company_id)) customByCompany.set(c.company_id, []);
    customByCompany.get(c.company_id)!.push(c);
  }

  const allCompanies = (companies ?? []) as Company[];
  const allDeadlines = computeCompanyDeadlines({
    companies: allCompanies,
    responsibilitiesByCompany,
    icaByCompany,
    customObligationsByCompany: customByCompany,
    taxCalendar: (taxCalendar ?? []) as TaxCalendarEntry[],
    submittedDeclarations: (submitted ?? []) as SubmittedDeclaration[],
    years,
  });
  const weekDeadlines = allDeadlines.filter(
    (d) => isWithinWeek(d.due_date, monday) && !d.presentado
  );

  const accessList = (access ?? []) as UserCompanyAccess[];
  const results: { user: string; sent: boolean; error?: string }[] = [];

  for (const profile of (profiles ?? []) as Profile[]) {
    const companyIds =
      profile.role === "admin"
        ? new Set(allCompanies.map((c) => c.id))
        : new Set(accessList.filter((a) => a.user_id === profile.id).map((a) => a.company_id));

    const userDeadlines = weekDeadlines.filter((d) => companyIds.has(d.company.id));

    const { data: authUser, error: userError } = await admin.auth.admin.getUserById(profile.id);
    if (userError || !authUser.user.email) {
      results.push({ user: profile.full_name, sent: false, error: "sin correo" });
      continue;
    }

    try {
      await sendWeeklyDigestEmail(
        authUser.user.email,
        `Vencimientos de la semana (${userDeadlines.length})`,
        buildWeeklyDigestHtml(profile.full_name, userDeadlines)
      );
      results.push({ user: profile.full_name, sent: true });
    } catch (err) {
      results.push({ user: profile.full_name, sent: false, error: String(err) });
    }
  }

  return NextResponse.json({ week_of: monday.toISOString().slice(0, 10), results });
}
