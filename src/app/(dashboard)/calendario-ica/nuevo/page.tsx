import { hasModule, requireAdmin } from "@/lib/auth";
import type { CompanyIca, IcaCalendarEntry, IcaPeriodicidad } from "@/lib/types";
import { ICA_PERIODICIDADES, normalizeMunicipio } from "@/lib/tax-rules/ica-calendar";
import { Paywall } from "../../paywall";
import { IcaCalendarForm } from "./ica-calendar-form";

export default async function NuevoCalendarioIcaPage({
  searchParams,
}: {
  searchParams: Promise<{ municipio?: string; year?: string; periodicidad?: string }>;
}) {
  const { supabase } = await requireAdmin();
  if (!(await hasModule(supabase, "vencimientos"))) {
    return <Paywall moduleName="Vencimientos tributarios" isAdmin />;
  }

  const params = await searchParams;
  const municipio = params.municipio ?? "";
  const year = Number(params.year) || new Date().getFullYear();
  const periodicidad = (ICA_PERIODICIDADES.some((p) => p.value === params.periodicidad)
    ? params.periodicidad
    : "bimestral") as IcaPeriodicidad;

  const [{ data: icas }, { data: existing }] = await Promise.all([
    supabase.from("company_ica").select("municipio"),
    municipio
      ? supabase
          .from("ica_calendar")
          .select("*")
          .eq("year", year)
          .eq("periodicidad", periodicidad)
          .order("due_date")
      : Promise.resolve({ data: [] }),
  ]);

  // Calendario ya cargado del mismo municipio (para editarlo)
  const current = ((existing ?? []) as IcaCalendarEntry[]).filter(
    (e) => normalizeMunicipio(e.municipio) === normalizeMunicipio(municipio)
  );
  const municipios = [...new Set(((icas ?? []) as Pick<CompanyIca, "municipio">[]).map((i) => i.municipio))].sort(
    (a, b) => a.localeCompare(b, "es")
  );

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Cargar calendario ICA</h1>
      <p className="mb-6 text-sm text-slate-500">
        Transcribe las fechas del acuerdo, decreto o resolución del municipio, o impórtalas desde un
        Excel/CSV con columnas <b>Periodo</b>, <b>Fecha</b> y, si el municipio las fija por NIT,{" "}
        <b>Último dígito</b>. Al guardar se reemplaza el calendario del mismo municipio, año y
        periodicidad.
      </p>
      <IcaCalendarForm
        municipios={municipios}
        initial={{
          municipio: current[0]?.municipio ?? municipio,
          year,
          periodicidad,
          rows: current.map((e) => ({
            period_label: e.period_label,
            due_date: e.due_date,
            last_nit_digit: e.last_nit_digit,
          })),
        }}
      />
    </div>
  );
}
