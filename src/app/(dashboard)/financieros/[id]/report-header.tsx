export interface ReportInfo {
  razonSocial: string;
  nit: string;
  periodStart: string;
  periodEnd: string;
  previousPeriodEnd: string | null;
}

export const fechaLarga = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });

/** Cifras en pesos, negativos entre paréntesis (presentación contable). */
export function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const rounded = Math.round(value);
  if (rounded === 0) return "-";
  const text = Math.abs(rounded).toLocaleString("es-CO");
  return rounded < 0 ? `(${text})` : text;
}

/** Encabezado formal de cada estado: entidad, NIT, nombre del estado y fecha. */
export function ReportHeader({ info, title, subtitle }: { info: ReportInfo; title: string; subtitle: string }) {
  return (
    <div className="mb-4 text-center">
      <p className="text-sm font-bold uppercase text-slate-900">{info.razonSocial}</p>
      <p className="text-xs text-slate-600">NIT {info.nit}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{title}</p>
      <p className="text-xs text-slate-600">{subtitle}</p>
      <p className="text-xs text-slate-500">(Cifras expresadas en pesos colombianos)</p>
    </div>
  );
}
