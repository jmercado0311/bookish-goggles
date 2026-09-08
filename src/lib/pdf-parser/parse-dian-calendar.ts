import type { PositionedItem } from "./extract-text";

export interface CandidateEntry {
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

const DATE_TEXT_RE = new RegExp(
  `\\b(\\d{1,2})\\s+de\\s+(${Object.keys(MESES).join("|")})\\b`,
  "i"
);
const DATE_NUMERIC_RE = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/;
const DIGIT_LABEL_RE = /^(\d)$/;

function toIsoDate(day: string, month: string, year: number): string {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function extractDateFromText(text: string, year: number): string | null {
  const textMatch = text.match(DATE_TEXT_RE);
  if (textMatch) {
    const [, day, monthName] = textMatch;
    const month = MESES[monthName.toLowerCase()];
    if (month) return toIsoDate(day, month, year);
  }

  const numericMatch = text.match(DATE_NUMERIC_RE);
  if (numericMatch) {
    const [, day, month, yr] = numericMatch;
    return toIsoDate(day, month, Number(yr));
  }

  return null;
}

/**
 * Agrupa los items del PDF en "líneas" según su coordenada Y (con tolerancia),
 * y dentro de cada línea busca un dígito (0-9, columna de último dígito del NIT)
 * y una fecha. Es un extractor de mejor esfuerzo: el resultado SIEMPRE debe
 * pasar por la pantalla de revisión manual antes de guardarse.
 */
export function parseCandidateEntries(
  items: PositionedItem[],
  year: number,
  yTolerance = 4
): CandidateEntry[] {
  const byPage = new Map<number, PositionedItem[]>();
  for (const item of items) {
    if (!byPage.has(item.page)) byPage.set(item.page, []);
    byPage.get(item.page)!.push(item);
  }

  const candidates: CandidateEntry[] = [];

  for (const [page, pageItems] of byPage) {
    const sorted = [...pageItems].sort((a, b) => b.y - a.y || a.x - b.x);

    const lines: PositionedItem[][] = [];
    for (const item of sorted) {
      const line = lines.find((l) => Math.abs(l[0].y - item.y) <= yTolerance);
      if (line) line.push(item);
      else lines.push([item]);
    }

    for (const line of lines) {
      const lineSorted = [...line].sort((a, b) => a.x - b.x);
      const lineText = lineSorted.map((i) => i.text).join(" ");

      const digitItem = lineSorted.find((i) => DIGIT_LABEL_RE.test(i.text));
      const dueDate = extractDateFromText(lineText, year);

      if (digitItem && dueDate) {
        candidates.push({
          last_nit_digit: Number(digitItem.text),
          due_date: dueDate,
          period_label: lineText.slice(0, 80),
          raw_context: lineText,
          page,
        });
      }
    }
  }

  return candidates;
}
