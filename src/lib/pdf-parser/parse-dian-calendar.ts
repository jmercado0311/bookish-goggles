import type { PositionedItem } from "./extract-text";
import type { NitMatchMode } from "@/lib/types";

export interface CandidateEntry {
  match_mode: NitMatchMode;
  last_nit_digit: number;
  due_date: string; // YYYY-MM-DD, mejor esfuerzo
  period_label: string;
  raw_context: string;
  page: number;
}

const MESES: Record<string, string> = {
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  setiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12",
};
const MES_NAMES = new Set(Object.keys(MESES));

const DIGIT_RE = /^[0-9]$/;
const RANGE_RE = /^\d{2}-\d{2}$/;
const DAY_RE = /^([12]?\d|3[01])$/; // 1 a 31
const DAY_GROUP_RE = /^\d{1,2}(\s+\d{1,2}){1,9}$/; // "10 11 12 13 16"
const YEAR_RE = /^20\d{2}$/;

function toIsoDate(year: number, month: string, day: number): string {
  return `${year}-${month}-${String(day).padStart(2, "0")}`;
}

interface Row {
  y: number;
  items: PositionedItem[];
}

/** Agrupa items de una página en filas según su coordenada Y (tolerancia ajustada). */
function groupRows(pageItems: PositionedItem[], tol = 2): Row[] {
  const sorted = [...pageItems].sort((a, b) => b.y - a.y);
  const rows: Row[] = [];
  for (const item of sorted) {
    const row = rows.find((r) => Math.abs(r.y - item.y) <= tol);
    if (row) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }
  for (const r of rows) r.items.sort((a, b) => a.x - b.x);
  rows.sort((a, b) => b.y - a.y);
  return rows;
}

/** Expande valores de día, incluyendo los que vienen pegados como "10 11 12 13 16". */
function expandDayValues(row: Row): number[] {
  const values: number[] = [];
  for (const it of [...row.items].sort((a, b) => a.x - b.x)) {
    if (DAY_RE.test(it.text)) {
      values.push(Number(it.text));
    } else if (DAY_GROUP_RE.test(it.text)) {
      for (const part of it.text.split(/\s+/)) {
        if (DAY_RE.test(part)) values.push(Number(part));
      }
    }
  }
  return values;
}

/**
 * Extrae vencimientos del calendario DIAN reconociendo su formato visual real:
 * una fila de "etiquetas" (los 10 dígitos del NIT, o rangos de 2 dígitos como
 * "27-28") seguida, unas filas más abajo, de la fila con los días del mes
 * correspondientes a cada etiqueta, en el mismo orden. El nombre del mes se
 * busca cerca de esa misma fila.
 *
 * Es un extractor de mejor esfuerzo: el resultado SIEMPRE debe pasar por la
 * pantalla de revisión manual antes de guardarse — nunca se aplica solo.
 */
export function parseCandidateEntries(
  items: PositionedItem[],
  year: number
): CandidateEntry[] {
  const byPage = new Map<number, PositionedItem[]>();
  for (const item of items) {
    if (!byPage.has(item.page)) byPage.set(item.page, []);
    byPage.get(item.page)!.push(item);
  }

  const candidates: CandidateEntry[] = [];

  for (const [page, pageItems] of byPage) {
    const rows = groupRows(pageItems);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const digitLabels = row.items.filter((it) => DIGIT_RE.test(it.text));
      const rangeLabels = row.items.filter((it) => RANGE_RE.test(it.text));

      let matchMode: NitMatchMode | null = null;
      let labels: PositionedItem[] | null = null;
      if (digitLabels.length >= 5) {
        matchMode = "last_digit";
        labels = digitLabels;
      } else if (rangeLabels.length >= 3) {
        matchMode = "last_two_digits";
        labels = rangeLabels;
      }
      if (!matchMode || !labels) continue;

      // La fila de días vive un poco más abajo (según lo observado en el
      // calendario real, entre 20 y 100 unidades) y contiene números 1-31.
      let valueRow: Row | null = null;
      for (let j = i + 1; j < rows.length && j < i + 4; j++) {
        const dy = row.y - rows[j].y;
        if (dy < 15 || dy > 110) continue;
        const dayCount = rows[j].items.filter(
          (it) => DAY_RE.test(it.text) || DAY_GROUP_RE.test(it.text)
        ).length;
        if (dayCount >= 2) {
          valueRow = rows[j];
          break;
        }
      }
      if (!valueRow) continue;

      const dayValues = expandDayValues(valueRow);
      if (dayValues.length !== labels.length) continue; // no cuadra 1 a 1, se descarta

      // El nombre del mes (y, si aparece, el año — para el caso "Enero 2027")
      // se busca SOLO en una ventana pequeña de filas alrededor de esta
      // etiqueta, nunca "arrastrado" de una sección anterior: en este PDF
      // eso llegó a pegarle el mes/año equivocado a una sección distinta.
      let monthName: string | null = null;
      let yearHint: number | null = null;
      for (let k = Math.max(0, i - 3); k < Math.min(rows.length, i + 2); k++) {
        for (const it of rows[k].items) {
          const low = it.text.toLowerCase();
          if (MES_NAMES.has(low)) monthName = low;
          if (YEAR_RE.test(it.text)) yearHint = Number(it.text);
        }
      }
      const month = monthName ? MESES[monthName] : null;
      if (!month) continue; // sin mes identificado cerca, mejor no adivinar
      const rowYear = yearHint ?? year;

      const sortedLabels = [...labels].sort((a, b) => a.x - b.x);
      // monthName no puede ser null aquí: month solo queda con un valor
      // cuando monthName tenía texto (ver el `if (!month) continue;` arriba).
      const monthLabel = monthName!.charAt(0).toUpperCase() + monthName!.slice(1);

      sortedLabels.forEach((labelItem, idx) => {
        const due_date = toIsoDate(rowYear, month, dayValues[idx]);

        if (matchMode === "last_digit") {
          candidates.push({
            match_mode: "last_digit",
            last_nit_digit: Number(labelItem.text),
            due_date,
            period_label: `${monthLabel} ${rowYear}`,
            raw_context: `dígito ${labelItem.text} · ${monthLabel} ${rowYear}`,
            page,
          });
        } else {
          // Un rango "27-28" son DOS valores de últimos-2-dígitos con la
          // misma fecha de vencimiento.
          for (const part of labelItem.text.split("-")) {
            candidates.push({
              match_mode: "last_two_digits",
              last_nit_digit: Number(part),
              due_date,
              period_label: `${monthLabel} ${rowYear} (rango ${labelItem.text})`,
              raw_context: `rango ${labelItem.text} · ${monthLabel} ${rowYear}`,
              page,
            });
          }
        }
      });
    }
  }

  return candidates;
}
