import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { Company, CompanyIca, CompanyResponsibility, CustomObligation } from "@/lib/types";
import { CompanyForm } from "../company-form";
import { ResponsibilitiesEditor } from "./responsibilities-editor";
import { IcaEditor } from "./ica-editor";
import { CustomObligationsEditor } from "./custom-obligations-editor";
import { DeleteCompanyButton } from "./delete-company-button";

export default async function EmpresaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, profile } = await requireUser();
  const isAdmin = profile.role === "admin";

  const [{ data: company }, { data: responsibilities }, { data: ica }, { data: customObligations }] =
    await Promise.all([
      supabase.from("companies").select("*").eq("id", id).single(),
      supabase.from("company_responsibilities").select("*").eq("company_id", id),
      supabase.from("company_ica").select("*").eq("company_id", id).maybeSingle(),
      supabase.from("custom_obligations").select("*").eq("company_id", id),
    ]);

  if (!company) notFound();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-1 text-lg font-semibold text-slate-900">
          {(company as Company).razon_social}
        </h1>
        <p className="text-sm text-slate-500">
          NIT {(company as Company).nit}
          {(company as Company).dv ? `-${(company as Company).dv}` : ""}
        </p>
      </div>

      {isAdmin ? (
        <CompanyForm company={company as Company} />
      ) : (
        <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          <p>
            {(company as Company).tipo_contribuyente} ·{" "}
            {(company as Company).regimen ?? "sin régimen"}
          </p>
          <p>
            {(company as Company).municipio}, {(company as Company).departamento}
          </p>
        </div>
      )}

      <ResponsibilitiesEditor
        companyId={id}
        responsibilities={(responsibilities ?? []) as CompanyResponsibility[]}
        readOnly={!isAdmin}
      />

      <IcaEditor companyId={id} ica={ica as CompanyIca | null} readOnly={!isAdmin} />

      <CustomObligationsEditor
        companyId={id}
        obligations={(customObligations ?? []) as CustomObligation[]}
        readOnly={!isAdmin}
      />

      {isAdmin && (
        <DeleteCompanyButton
          companyId={id}
          razonSocial={(company as Company).razon_social}
        />
      )}
    </div>
  );
}
