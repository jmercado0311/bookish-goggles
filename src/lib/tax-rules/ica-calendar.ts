import type { IcaPeriodicidad } from "@/lib/types";

/**
 * Utilidades para cargar calendarios de ICA municipales: cada municipio
 * publica su calendario en un formato distinto (decreto, resolución, PDF,
 * página web), así que el despacho lo digita o lo importa de un Excel/CSV
 * con columnas Periodo, Fecha y, si aplica, Último dígito del NIT.
 */

export const ICA_PERIODICIDADES: { value: IcaPeriodicidad; label: string }[] = [
  { value: "mensual", label: "Mensual" },
  { value: "bimestral", label: "Bimestral" },
  { value: "cuatrimestral", label: "Cuatrimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
];

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Periodos gravables sugeridos para la periodicidad. */
export function periodTemplate(periodicidad: IcaPeriodicidad, year: number): string[] {
  const span = { mensual: 1, bimestral: 2, cuatrimestral: 4, semestral: 6, anual: 12 }[periodicidad];
  if (span === 12) return [`Año gravable ${year - 1}`];
  const labels: string[] = [];
  for (let m = 0; m < 12; m += span) {
    labels.push(span === 1 ? cap(MESES[m]) : `${cap(MESES[m])}-${cap(MESES[m + span - 1])}`);
  }
  return labels;
}

/** Fecha en ISO a partir de "15/03/2026", "2026-03-15", "15-03-2026" o "15 de marzo de 2026". */
export function parseDateCell(cell: unknown): string | null {
  if (cell === null || cell === undefined) return null;
  const text = String(cell).trim().toLowerCase();
  if (!text) return null;

  const pad = (n: number) => String(n).padStart(2, "0");
  const build = (y: number, m: number, d: number) => {
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
      ? `${y}-${pad(m)}-${pad(d)}`
      : null;
  };

  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return build(+m[1], +m[2], +m[3]);
  m = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) return build(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = text.match(/^(\d{1,2})\s+(?:de\s+)?([a-záéíóú]+)\.?\s+(?:de\s+|del\s+)?(\d{4})$/);
  if (m) {
    const month = MESES.findIndex((name) => name.startsWith(m![2].slice(0, 3)));
    if (month >= 0) return build(+m[3], month + 1, +m[1]);
  }
  return null;
}

/** Último dígito del NIT: número 0-9, o null si la celda dice "todos" o está vacía. */
export function parseDigitCell(cell: unknown): number | null | "invalido" {
  const text = String(cell ?? "").trim().toLowerCase();
  if (!text || /todo|general|n\/?a|^-$/.test(text)) return null;
  const n = Number(text);
  return Number.isInteger(n) && n >= 0 && n <= 9 ? n : "invalido";
}

export interface IcaRow {
  period_label: string;
  due_date: string;
  last_nit_digit: number | null;
}

/** Lee filas Periodo / Fecha / Dígito (opcional) de una hoja; detecta los encabezados. */
export function parseIcaSheet(rows: unknown[][]): { rows: IcaRow[]; errors: string[] } {
  const errors: string[] = [];
  let header = -1;
  let cols = { periodo: -1, fecha: -1, digito: -1 };

  for (let r = 0; r < Math.min(rows.length, 30) && header < 0; r++) {
    const cells = (rows[r] ?? []).map((c) => String(c ?? "").trim().toLowerCase());
    const periodo = cells.findIndex((c) => /periodo|bimestre|mes|per[ií]odo gravable|vigencia/.test(c));
    const fecha = cells.findIndex((c) => /fecha|vence|vencimiento|plazo|l[ií]mite/.test(c));
    if (periodo >= 0 && fecha >= 0 && periodo !== fecha) {
      header = r;
      cols = { periodo, fecha, digito: cells.findIndex((c) => /d[ií]gito|nit|terminaci/.test(c)) };
    }
  }
  if (header < 0) {
    return { rows: [], errors: ['No se encontraron las columnas "Periodo" y "Fecha" en las primeras filas.'] };
  }

  const out: IcaRow[] = [];
  rows.slice(header + 1).forEach((row, i) => {
    const period = String(row?.[cols.periodo] ?? "").trim();
    const rawDate = row?.[cols.fecha];
    if (!period && (rawDate === null || rawDate === undefined || String(rawDate).trim() === "")) return;
    const date = parseDateCell(rawDate);
    const digit = cols.digito >= 0 ? parseDigitCell(row?.[cols.digito]) : null;
    const line = header + i + 2;
    if (!period) errors.push(`Fila ${line}: falta el periodo.`);
    else if (!date) errors.push(`Fila ${line}: la fecha "${rawDate ?? ""}" no es válida.`);
    else if (digit === "invalido") errors.push(`Fila ${line}: el dígito debe ser de 0 a 9 o "Todos".`);
    else out.push({ period_label: period, due_date: date, last_nit_digit: digit });
  });
  return { rows: out, errors };
}
