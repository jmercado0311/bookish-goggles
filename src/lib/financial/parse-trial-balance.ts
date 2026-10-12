import { classifyAccount, isCreditNatureAccount } from "./puc-mapping";

/**
 * Lectura del balance de prueba exportado por el software contable (Siigo,
 * World Office, Alegra, Helisa, ContaPyme, etc.) a Excel/CSV.
 *
 * El archivo ya llega como una matriz de celdas; aquí se detectan las
 * columnas, se toman solo las cuentas de último nivel (para no sumar dos
 * veces clase, grupo, cuenta y subcuenta) y se normaliza el signo:
 * positivo = saldo débito, negativo = saldo crédito.
 */

export type Cell = string | number | null | undefined;

export type ColumnKey = "code" | "name" | "saldo_anterior" | "debitos" | "creditos" | "saldo_final";

export type ColumnMap = Record<ColumnKey, number | null>;

export type SignMode = "auto" | "debit_positive" | "nature";

export interface ParsedLine {
  account_code: string;
  account_name: string;
  saldo_anterior: number;
  debitos: number;
  creditos: number;
  saldo_final: number;
  rubro: string;
}

export interface ParseResult {
  lines: ParsedLine[];
  detectedSignMode: Exclude<SignMode, "auto">;
  warnings: string[];
  /** Suma de saldos finales con signo: debe ser 0 si el balance cuadra. */
  differenceFinal: number;
  differenceAnterior: number;
}

const HEADER_PATTERNS: Record<ColumnKey, RegExp[]> = {
  code: [/c[oó]d/i, /^cuenta$/i, /^cta\.?$/i, /^auxiliar$/i],
  name: [/nombre/i, /descrip/i, /detalle/i, /concepto/i, /^cuenta$/i],
  saldo_anterior: [/saldo\s*(anterior|inicial)/i, /^anterior$/i, /^inicial$/i, /saldo\s*ant/i],
  debitos: [/d[eé]bito/i, /^debe$/i, /mov.*d[eé]b/i],
  creditos: [/cr[eé]dito/i, /^haber$/i, /mov.*cr[eé]d/i],
  saldo_final: [/saldo\s*(final|actual|nuevo)/i, /nuevo\s*saldo/i, /^saldo$/i, /^final$/i, /saldo\s*a\s*la\s*fecha/i],
};

function cellText(cell: Cell): string {
  return cell === null || cell === undefined ? "" : String(cell).trim();
}

/** Busca la fila de encabezados y propone qué columna es cada dato. */
export function detectColumns(rows: Cell[][]): { headerRow: number; columns: ColumnMap } {
  let best = { headerRow: 0, columns: emptyColumnMap(), score: -1 };

  for (let r = 0; r < Math.min(rows.length, 40); r++) {
    const headers = (rows[r] ?? []).map(cellText);
    const columns = emptyColumnMap();
    const used = new Set<number>();

    // El orden importa: "cuenta" puede ser código o nombre, se resuelve primero el código.
    for (const key of ["code", "saldo_anterior", "debitos", "creditos", "saldo_final", "name"] as ColumnKey[]) {
      for (const pattern of HEADER_PATTERNS[key]) {
        const idx = headers.findIndex((h, i) => h && !used.has(i) && pattern.test(h));
        if (idx >= 0) {
          columns[key] = idx;
          used.add(idx);
          break;
        }
      }
    }

    const score = Object.values(columns).filter((v) => v !== null).length;
    if (score > best.score) best = { headerRow: r, columns, score };
  }

  return { headerRow: best.headerRow, columns: best.columns };
}

export function emptyColumnMap(): ColumnMap {
  return { code: null, name: null, saldo_anterior: null, debitos: null, creditos: null, saldo_final: null };
}

/** Convierte "1.234.567,89", "(1.500)", "-1,234.56", "$ 2.000" o números de Excel. */
export function parseAmount(cell: Cell): number {
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : 0;
  let text = cellText(cell);
  if (!text) return 0;

  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (/-\s*$/.test(text) || /^\s*-/.test(text)) negative = true;
  text = text.replace(/[^\d.,]/g, "");
  if (!text) return 0;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // El separador que aparece de último es el decimal
    text = lastComma > lastDot ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  } else if (lastComma > -1) {
    // Solo comas: decimal si hay 1-2 dígitos después de la última, si no miles
    const decimals = text.length - lastComma - 1;
    text = decimals > 0 && decimals <= 2 && text.split(",").length === 2 ? text.replace(",", ".") : text.replace(/,/g, "");
  } else if (lastDot > -1) {
    const decimals = text.length - lastDot - 1;
    if (!(decimals > 0 && decimals <= 2 && text.split(".").length === 2)) text = text.replace(/\./g, "");
  }

  const value = Number(text);
  if (!Number.isFinite(value)) return 0;
  return negative ? -value : value;
}

function normalizeCode(cell: Cell): string {
  return cellText(cell).replace(/[\s.\-]/g, "");
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const TOLERANCE = 1; // pesos

export function parseTrialBalance(
  rows: Cell[][],
  headerRow: number,
  columns: ColumnMap,
  signMode: SignMode
): ParseResult {
  const warnings: string[] = [];
  if (columns.code === null) {
    return { lines: [], detectedSignMode: "debit_positive", warnings: ["Selecciona la columna del código de la cuenta."], differenceFinal: 0, differenceAnterior: 0 };
  }
  if (columns.saldo_final === null) {
    return { lines: [], detectedSignMode: "debit_positive", warnings: ["Selecciona la columna del saldo final."], differenceFinal: 0, differenceAnterior: 0 };
  }

  const get = (row: Cell[], key: ColumnKey) => (columns[key] === null ? undefined : row[columns[key]!]);

  // 1. Filas con código numérico (las de totales o terceros sin código se omiten)
  const byCode = new Map<string, ParsedLine>();
  let duplicated = 0;
  for (const row of rows.slice(headerRow + 1)) {
    if (!row) continue;
    const code = normalizeCode(get(row, "code"));
    if (!/^\d+$/.test(code)) continue;

    const line: ParsedLine = {
      account_code: code,
      account_name: cellText(get(row, "name")) || code,
      saldo_anterior: parseAmount(get(row, "saldo_anterior")),
      debitos: Math.abs(parseAmount(get(row, "debitos"))),
      creditos: Math.abs(parseAmount(get(row, "creditos"))),
      saldo_final: parseAmount(get(row, "saldo_final")),
      rubro: classifyAccount(code),
    };

    const existing = byCode.get(code);
    if (existing) {
      duplicated++;
      existing.saldo_anterior += line.saldo_anterior;
      existing.debitos += line.debitos;
      existing.creditos += line.creditos;
      existing.saldo_final += line.saldo_final;
    } else {
      byCode.set(code, line);
    }
  }
  if (duplicated > 0) {
    warnings.push(`${duplicated} filas repetían un código de cuenta y se sumaron (por ejemplo, detalle por tercero).`);
  }

  // 2. Solo cuentas de último nivel
  const codes = [...byCode.keys()];
  const leaves = codes
    .filter((code) => !codes.some((other) => other !== code && other.length > code.length && other.startsWith(code)))
    .map((code) => byCode.get(code)!);

  // 3. Signo
  const hasMovements = columns.debitos !== null && columns.creditos !== null;
  // Deciden las cuentas de naturaleza crédito: en un archivo "débito
  // positivo" cuadran con saldo + débitos - créditos; en uno "según
  // naturaleza" cuadran con saldo - débitos + créditos. Las cuentas débito
  // cuadran igual en ambos formatos y no sirven para decidir.
  let debitFits = 0;
  let natureFits = 0;
  for (const l of leaves.filter((x) => isCreditNatureAccount(x.account_code))) {
    const fitsDebit = Math.abs(l.saldo_anterior + l.debitos - l.creditos - l.saldo_final) <= TOLERANCE;
    const fitsNature = Math.abs(l.saldo_anterior - l.debitos + l.creditos - l.saldo_final) <= TOLERANCE;
    if (fitsDebit && !fitsNature) debitFits++;
    if (fitsNature && !fitsDebit) natureFits++;
  }
  let detected: Exclude<SignMode, "auto">;
  if (hasMovements && debitFits + natureFits > 0) {
    detected = natureFits > debitFits ? "nature" : "debit_positive";
  } else {
    // Sin movimientos: si los pasivos/patrimonio/ingresos vienen positivos, es "según naturaleza"
    const creditSide = leaves.filter((l) => ["2", "3", "4"].includes(l.account_code[0]));
    const positives = creditSide.filter((l) => l.saldo_final > 0).length;
    detected = creditSide.length > 0 && positives > creditSide.length / 2 ? "nature" : "debit_positive";
  }
  const mode = signMode === "auto" ? detected : signMode;

  if (mode === "nature") {
    for (const l of leaves) {
      const fitsDebit = hasMovements && Math.abs(l.saldo_anterior + l.debitos - l.creditos - l.saldo_final) <= TOLERANCE;
      const fitsNature = hasMovements && Math.abs(l.saldo_anterior - l.debitos + l.creditos - l.saldo_final) <= TOLERANCE;
      const isCredit = fitsNature && !fitsDebit ? true : fitsDebit && !fitsNature ? false : isCreditNatureAccount(l.account_code);
      if (isCredit) {
        l.saldo_anterior = -l.saldo_anterior;
        l.saldo_final = -l.saldo_final;
      }
    }
  }

  for (const l of leaves) {
    l.saldo_anterior = round2(l.saldo_anterior);
    l.saldo_final = round2(l.saldo_final);
    l.debitos = round2(l.debitos);
    l.creditos = round2(l.creditos);
  }

  const differenceFinal = round2(leaves.reduce((s, l) => s + l.saldo_final, 0));
  const differenceAnterior = round2(leaves.reduce((s, l) => s + l.saldo_anterior, 0));

  if (Math.abs(differenceFinal) > TOLERANCE) {
    warnings.push(
      `El balance no cuadra: los saldos finales débito y crédito difieren en ${differenceFinal.toLocaleString("es-CO")}. Revisa la columna de saldo final o el formato de signos.`
    );
  }
  if (columns.saldo_anterior !== null && Math.abs(differenceAnterior) > TOLERANCE) {
    warnings.push(`Los saldos anteriores no cuadran (diferencia ${differenceAnterior.toLocaleString("es-CO")}); el comparativo del estado de situación financiera puede quedar descuadrado.`);
  }
  if (leaves.some((l) => l.account_code.startsWith("19") && l.saldo_final !== 0)) {
    warnings.push("Hay saldos en valorizaciones (19/38). Bajo NIIF no proceden: revisa su tratamiento en la conversión.");
  }
  const unclassified = leaves.filter((l) => l.rubro === "sin_clasificar").length;
  if (unclassified > 0) warnings.push(`${unclassified} cuentas no se pudieron clasificar; asígnales un rubro en la pestaña Clasificación.`);

  return { lines: leaves, detectedSignMode: detected, warnings, differenceFinal, differenceAnterior };
}

/** CSV simple con separador ; o , (el que más aparezca en la primera línea). */
export function parseCsv(text: string): Cell[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: Cell[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
