import type {
  Company,
  CompanyDeadline,
  CompanyIca,
  CompanyResponsibility,
  CustomObligation,
  TaxCalendarEntry,
} from "@/lib/types";
import { responsibilityName } from "./responsibilities";

function lastDigit(nit: string): number {
  const digits = nit.replace(/\D/g, "");
  return Number(digits[digits.length - 1] ?? "0");
}

/**
 * Últimos DOS dígitos del NIT como número (ej. "...531" -> 31). Lo usan
 * responsabilidades como "Renta - Personas naturales", cuyo calendario DIAN
 * agrupa por parejas de dígitos en vez de un solo dígito.
 */
function lastTwoDigits(nit: string): number {
  const digits = nit.replace(/\D/g, "");
  return Number(digits.slice(-2).padStart(2, "0"));
}

/** Próxima fecha (>= hoy) para una regla de día fijo mensual; si ya pasó este mes, usa el próximo. */
function nextOccurrenceForDay(day: number, from: Date = new Date()): string {
  const candidate = new Date(from.getFullYear(), from.getMonth(), day);
  if (candidate < new Date(from.getFullYear(), from.getMonth(), from.getDate())) {
    candidate.setMonth(candidate.getMonth() + 1);
  }
  return candidate.toISOString().slice(0, 10);
}

export function computeCompanyDeadlines(input: {
  companies: Company[];
  responsibilitiesByCompany: Map<string, CompanyResponsibility[]>;
  icaByCompany: Map<string, CompanyIca>;
  customObligationsByCompany: Map<string, CustomObligation[]>;
  taxCalendar: TaxCalendarEntry[];
  year: number;
}): CompanyDeadline[] {
  const { companies, responsibilitiesByCompany, icaByCompany, customObligationsByCompany, taxCalendar, year } =
    input;

  const deadlines: CompanyDeadline[] = [];

  for (const company of companies) {
    const digit = lastDigit(company.nit);
    const twoDigits = lastTwoDigits(company.nit);
    const responsibilities = responsibilitiesByCompany.get(company.id) ?? [];

    const esPersonaNatural = company.tipo_contribuyente === "persona_natural";
    const esGranContribuyente = responsibilities.some((r) => r.code === "10");

    for (const resp of responsibilities) {
      const matches = taxCalendar.filter((t) => {
        if (t.year !== year || t.responsibility_code !== resp.code) return false;

        // "05" (Renta): comparte código de RUT entre personas naturales (rango
        // de 2 dígitos) y jurídicas (1 dígito), con calendarios distintos.
        if (resp.code === "05") {
          return t.match_mode === "last_two_digits"
            ? esPersonaNatural && t.last_nit_digit === twoDigits
            : !esPersonaNatural && t.last_nit_digit === digit;
        }

        // "14" (Informante de exógena): los grandes contribuyentes tienen su
        // propio calendario de 1 dígito; el resto de empresas (naturales y
        // jurídicas juntas) usa rangos de 2 dígitos.
        if (resp.code === "14") {
          return t.match_mode === "last_two_digits"
            ? !esGranContribuyente && t.last_nit_digit === twoDigits
            : esGranContribuyente && t.last_nit_digit === digit;
        }

        return t.last_nit_digit === digit;
      });
      for (const m of matches) {
        deadlines.push({
          company,
          responsibility_code: resp.code,
          responsibility_name: responsibilityName(resp.code),
          period_label: m.period_label,
          due_date: m.due_date,
          source: "dian",
        });
      }
    }

    const ica = icaByCompany.get(company.id);
    if (ica) {
      const dueDate = ica.fecha_puntual ?? (ica.regla_dia_mes ? nextOccurrenceForDay(ica.regla_dia_mes) : null);
      if (dueDate) {
        deadlines.push({
          company,
          responsibility_code: "ICA",
          responsibility_name: `ICA (${ica.municipio})`,
          period_label: ica.periodicidad,
          due_date: dueDate,
          source: "ica",
        });
      }
    }

    const customs = customObligationsByCompany.get(company.id) ?? [];
    for (const c of customs) {
      const dueDate = c.fecha_puntual ?? (c.regla_dia_mes ? nextOccurrenceForDay(c.regla_dia_mes) : null);
      if (dueDate) {
        deadlines.push({
          company,
          responsibility_code: c.tipo,
          responsibility_name: c.nombre,
          period_label: c.regla_dia_mes ? `día ${c.regla_dia_mes} de cada mes` : "fecha puntual",
          due_date: dueDate,
          source: "custom",
        });
      }
    }
  }

  return deadlines.sort((a, b) => a.due_date.localeCompare(b.due_date));
}
