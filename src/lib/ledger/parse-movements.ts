/**
 * Lectura de movimientos de extractos bancarios y libros auxiliares sin
 * importar su estructura.
 *
 * Todo archivo se reduce a un "mapa de columnas" (qué columna es la fecha,
 * cuál el débito, etc.). El mapa lo propone `detectMapping` con reglas; si
 * las reglas no entienden el archivo, el servidor le pide el mapa a la IA
 * (ver src/lib/ledger/ai.ts) y el resto del proceso es idéntico, en el
 * navegador. El usuario siempre puede corregir el mapa a mano.
 *
 * Convención de `valor`: perspectiva de la empresa, positivo = entra dinero
 * (consignación) y negativo = sale dinero (retiro, cheque, nota débito).
 * - Extracto bancario: el banco llama "débito" al retiro y "crédito" a la
 *   consignación, así que valor = crédito - débito.
 * - Libro auxiliar: débito aumenta la cuenta del activo, valor = débito - crédito.
 */

export type Cell = string | number | null | undefined;
export type SourceKind = "extracto" | "auxiliar";

export type FieldKey =
  | "fecha"
  | "descripcion"
  | "documento"
  | "tercero"
  | "nit"
  | "cuenta"
  | "cuenta_nombre"
  | "debito"
  | "credito"
  | "valor"
  | "tipo"
  | "saldo";

export type DateOrder = "dmy" | "mdy" | "ymd";

export interface ColumnMapping {
  headerRow: number;
  columns: Partial<Record<FieldKey, number>>;
  dateOrder: DateOrder;
  /** Solo con columna "valor": true si en el archivo los retiros vienen positivos y las consignaciones negativas. */
  invertValor?: boolean;
  /** Solo con débito/crédito: true si el archivo los trae al revés de su convención. */
  swapDebitCredit?: boolean;
}

export interface Movement {
  row: number;
  fecha: string;
  descripcion: string;
  documento: string;
  tercero: string;
  nit: string;
  cuenta: string;
  cuenta_nombre: string;
  debito: number;
  credito: number;
  saldo: number | null;
  valor: number;
}

export interface ParseOutcome {
  movements: Movement[];
  warnings: string[];
  /** Filas con fecha y monto válidos sobre filas candidatas. */
  parsedRatio: number;
  /** Continuidad del saldo (saldo anterior + valor = saldo) cuando hay columna de saldo. */
  continuity: { checked: number; ok: number } | null;
}

export const FIELD_LABELS: Record<FieldKey, string> = {
  fecha: "Fecha",
  descripcion: "Descripción / concepto",
  documento: "Documento / comprobante",
  tercero: "Tercero (nombre)",
  nit: "NIT / identificación",
  cuenta: "Código de cuenta",
  cuenta_nombre: "Nombre de la cuenta",
  debito: "Débito",
  credito: "Crédito",
  valor: "Valor (con signo)",
  tipo: "Tipo (D/C)",
  saldo: "Saldo",
};

// ---------------------------------------------------------------------------
// Valores
// ---------------------------------------------------------------------------

const text = (cell: Cell) => (cell === null || cell === undefined ? "" : String(cell).trim());

/** Monto en formato colombiano o internacional: "1.234.567,89", "(1.500)", "-2,000.50", "$ 3.000 CR". */
export function parseAmount(cell: Cell): number | null {
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
  let t = text(cell);
  if (!t) return null;
  let negative = /^\(.*\)$/.test(t) || /^-|-$/.test(t.replace(/\s/g, ""));
  if (/\b(db|dr)\b/i.test(t)) negative = true;
  t = t.replace(/[^\d.,]/g, "");
  if (!t || !/\d/.test(t)) return null;
  const lastComma = t.lastIndexOf(",");
  const lastDot = t.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    t = lastComma > lastDot ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (lastComma > -1) {
    const decimals = t.length - lastComma - 1;
    t = decimals > 0 && decimals <= 2 && t.split(",").length === 2 ? t.replace(",", ".") : t.replace(/,/g, "");
  } else if (lastDot > -1) {
    const decimals = t.length - lastDot - 1;
    if (!(decimals > 0 && decimals <= 2 && t.split(".").length === 2)) t = t.replace(/\./g, "");
  }
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

const MONTHS: Record<string, number> = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7, ago: 8, aug: 8,
  sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12,
};

function isoDate(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  if (y < 1990 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Fecha en ISO. Acepta fechas de Excel (número de serie o ISO ya convertido),
 * "15/03/2026", "03/15/2026" (según el orden), "2026-03-15", "15-mar-2026",
 * "15 MAR 2026" y "20260315". `defaultYear` completa fechas sin año ("15/03").
 */
export function parseDate(cell: Cell, order: DateOrder, defaultYear?: number): string | null {
  if (typeof cell === "number") {
    if (cell > 30000 && cell < 80000) {
      const date = new Date(Date.UTC(1899, 11, 30) + Math.round(cell) * 86400000);
      return date.toISOString().slice(0, 10);
    }
    if (cell > 19900101 && cell < 21001231) {
      const s = String(cell);
      return isoDate(+s.slice(0, 4), +s.slice(4, 6), +s.slice(6, 8));
    }
    return null;
  }
  const t = text(cell).toLowerCase();
  if (!t) return null;

  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return isoDate(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{8})$/);
  if (m) return isoDate(+t.slice(0, 4), +t.slice(4, 6), +t.slice(6, 8));
  m = t.match(/^(\d{1,2})[-/. ]+([a-záéíóú]{3,})\.?[-/. ]+(\d{2,4})/);
  if (m && MONTHS[m[2].slice(0, 3)]) return isoDate(+m[3], MONTHS[m[2].slice(0, 3)], +m[1]);
  m = t.match(/^(\d{1,2})[-/. ]+([a-záéíóú]{3,})\.?$/);
  if (m && MONTHS[m[2].slice(0, 3)] && defaultYear) return isoDate(defaultYear, MONTHS[m[2].slice(0, 3)], +m[1]);
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:\s|$)/);
  if (m) {
    return order === "mdy" ? isoDate(+m[3], +m[1], +m[2]) : isoDate(+m[3], +m[2], +m[1]);
  }
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})$/);
  if (m && defaultYear) return order === "mdy" ? isoDate(defaultYear, +m[1], +m[2]) : isoDate(defaultYear, +m[2], +m[1]);
  return null;
}

// ---------------------------------------------------------------------------
// Detección de columnas por reglas
// ---------------------------------------------------------------------------

const PATTERNS: [FieldKey, RegExp][] = [
  ["cuenta_nombre", /nombre\s*(de\s*la\s*)?cuenta|descripci[oó]n\s*(de\s*la\s*)?cuenta|nombre\s*cta/],
  ["saldo", /saldo|balance/],
  ["debito", /d[eé]bit|^debe$|cargo|retiro|egreso|salida|withdraw/],
  ["credito", /cr[eé]dit|^haber$|abono|consignaci|dep[oó]sito|ingreso|entrada/],
  ["valor", /^valor|monto|importe|amount|^vr\.?|valor\s*(del\s*)?mov/],
  ["tipo", /^tipo$|naturaleza|^d\/c$|^db\/cr$|^dc$|tipo\s*mov/],
  ["fecha", /fecha|^date|f\.?\s*mov|^fec\b|^dia$/],
  ["nit", /^nit|c[eé]dula|identificaci|^id\s*tercero|nit\s*tercero|documento\s*tercero/],
  ["tercero", /tercero|beneficiario|raz[oó]n\s*social|^nombre$|cliente|proveedor/],
  ["documento", /comprob|^doc|dcto|n[uú]mero|nro|^no\.?\s|consecutivo|soporte|cheque|referencia|^ref|check/],
  ["cuenta", /^cuenta$|^c[oó]digo|^cta\.?$|^auxiliar$|c[oó]d\.?\s*cuenta|cuenta\s*contable/],
  ["descripcion", /descrip|concepto|detalle|transacci|narrativa|movimiento|observ|glosa/],
];

function scoreHeader(cells: string[]) {
  const columns: Partial<Record<FieldKey, number>> = {};
  const used = new Set<number>();
  for (const [field, pattern] of PATTERNS) {
    const idx = cells.findIndex((c, i) => c && !used.has(i) && pattern.test(c));
    if (idx >= 0 && columns[field] === undefined) {
      columns[field] = idx;
      used.add(idx);
    }
  }
  const hasAmount = (columns.debito !== undefined && columns.credito !== undefined) || columns.valor !== undefined;
  const score = Object.keys(columns).length + (columns.fecha !== undefined ? 3 : 0) + (hasAmount ? 3 : 0);
  return { columns, score };
}

/** Orden de fecha más probable mirando valores como 13/02 (día primero) o 02/13 (mes primero). */
function guessDateOrder(rows: Cell[][], col: number | undefined): DateOrder {
  if (col === undefined) return "dmy";
  let dmy = 0;
  let mdy = 0;
  for (const row of rows.slice(0, 300)) {
    const m = text(row?.[col]).match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/);
    if (!m) continue;
    if (+m[1] > 12) dmy++;
    if (+m[2] > 12) mdy++;
  }
  return mdy > dmy ? "mdy" : "dmy";
}

export interface DetectionResult {
  mapping: ColumnMapping;
  /** 0 a 1: qué tan seguro está el lector de haber entendido el archivo. */
  confidence: number;
  outcome: ParseOutcome;
}

export function detectMapping(rows: Cell[][], kind: SourceKind): DetectionResult {
  let best = { headerRow: 0, columns: {} as Partial<Record<FieldKey, number>>, score: -1 };
  for (let r = 0; r < Math.min(rows.length, 60); r++) {
    const cells = (rows[r] ?? []).map((c) => text(c).toLowerCase());
    const { columns, score } = scoreHeader(cells);
    if (score > best.score) best = { headerRow: r, columns, score };
  }
  const body = rows.slice(best.headerRow + 1);
  const mapping: ColumnMapping = {
    headerRow: best.headerRow,
    columns: best.columns,
    dateOrder: guessDateOrder(body, best.columns.fecha),
  };
  const fixed = fixSigns(rows, mapping, kind);
  const outcome = fixed.result;
  const hasCore =
    mapping.columns.fecha !== undefined &&
    ((mapping.columns.debito !== undefined && mapping.columns.credito !== undefined) || mapping.columns.valor !== undefined);
  let confidence = hasCore ? outcome.parsedRatio : 0;
  if (outcome.continuity && outcome.continuity.checked >= 3) {
    confidence = Math.min(confidence, outcome.continuity.ok / outcome.continuity.checked);
  }
  if (outcome.movements.length < 2) confidence = 0;
  return { mapping: fixed.mapping, confidence, outcome };
}

/**
 * Prueba las convenciones de signo posibles y se queda con la que hace que el
 * saldo cuadre fila a fila. Así detecta extractos con débito/crédito al revés
 * o valores con el signo invertido, sin preguntarle al usuario.
 */
export function fixSigns(rows: Cell[][], mapping: ColumnMapping, kind: SourceKind) {
  const variants: ColumnMapping[] =
    mapping.columns.valor !== undefined && mapping.columns.debito === undefined
      ? [mapping, { ...mapping, invertValor: true }]
      : [mapping, { ...mapping, swapDebitCredit: true }];
  let bestMapping = variants[0];
  let bestResult = applyMapping(rows, variants[0], kind);
  if (bestResult.continuity && bestResult.continuity.checked > 0) {
    const second = applyMapping(rows, variants[1], kind);
    if (second.continuity && second.continuity.ok > bestResult.continuity.ok) {
      bestMapping = variants[1];
      bestResult = second;
    }
  }
  return { mapping: bestMapping, result: bestResult };
}

// ---------------------------------------------------------------------------
// Aplicación del mapa
// ---------------------------------------------------------------------------

const ACCOUNT_HEADER = /^(?:cuenta\s*:?\s*)?(\d{4,12})\s*[-–:]?\s*(.*)$/i;
const TOTAL_ROW = /^(total|totales|subtotal|saldo\s*(anterior|inicial|final)|suman|gran\s*total)/i;

export function applyMapping(rows: Cell[][], mapping: ColumnMapping, kind: SourceKind, defaultYear?: number): ParseOutcome {
  const c = mapping.columns;
  const get = (row: Cell[], key: FieldKey) => (c[key] === undefined ? undefined : row[c[key]!]);
  const warnings: string[] = [];
  const movements: Movement[] = [];
  let candidates = 0;
  let currentAccount = { code: "", name: "" };

  rows.slice(mapping.headerRow + 1).forEach((row, i) => {
    if (!row || row.every((cell) => text(cell) === "")) return;
    const rowNumber = mapping.headerRow + i + 2;
    const firstText = text(row.find((cell) => text(cell) !== ""));

    const fecha = parseDate(get(row, "fecha"), mapping.dateOrder, defaultYear);

    // Auxiliares que agrupan por cuenta: "111005 Bancos nacionales" en una fila sin fecha
    if (!fecha) {
      const acc = firstText.match(ACCOUNT_HEADER);
      if (kind === "auxiliar" && acc && c.cuenta === undefined) currentAccount = { code: acc[1], name: acc[2].trim() };
      return;
    }
    if (TOTAL_ROW.test(text(get(row, "descripcion"))) || TOTAL_ROW.test(firstText)) return;
    candidates++;

    let debito = 0;
    let credito = 0;
    if (c.debito !== undefined || c.credito !== undefined) {
      debito = Math.abs(parseAmount(get(row, "debito")) ?? 0);
      credito = Math.abs(parseAmount(get(row, "credito")) ?? 0);
      if (mapping.swapDebitCredit) [debito, credito] = [credito, debito];
    } else if (c.valor !== undefined) {
      let v = parseAmount(get(row, "valor"));
      if (v === null) return;
      const tipo = text(get(row, "tipo")).toLowerCase();
      if (tipo) {
        const isDebit = /^(d|db|dr|deb|d[eé]bito|cargo|retiro)/.test(tipo);
        v = Math.abs(v) * (isDebit ? -1 : 1);
        // En un auxiliar el "D" suma; en un extracto el "D" del banco resta
        if (kind === "auxiliar") v = -v;
      }
      if (mapping.invertValor) v = -v;
      // v está en la convención del archivo: positivo = crédito en extracto, débito en auxiliar
      if (kind === "extracto") {
        if (v >= 0) credito = v;
        else debito = -v;
      } else if (v >= 0) debito = v;
      else credito = -v;
    }
    if (debito === 0 && credito === 0) return;

    const saldo = c.saldo !== undefined ? parseAmount(get(row, "saldo")) : null;
    const cuenta = text(get(row, "cuenta")).replace(/[\s.]/g, "") || currentAccount.code;
    movements.push({
      row: rowNumber,
      fecha,
      descripcion: text(get(row, "descripcion")),
      documento: text(get(row, "documento")),
      tercero: text(get(row, "tercero")),
      nit: text(get(row, "nit")),
      cuenta,
      cuenta_nombre: text(get(row, "cuenta_nombre")) || (cuenta === currentAccount.code ? currentAccount.name : ""),
      debito: round2(debito),
      credito: round2(credito),
      saldo: saldo === null ? null : round2(saldo),
      valor: round2(kind === "extracto" ? credito - debito : debito - credito),
    });
  });

  const continuity = checkContinuity(movements, kind);
  if (continuity && continuity.checked >= 3 && continuity.ok / continuity.checked < 0.9) {
    warnings.push(
      `El saldo no cuadra fila a fila en ${continuity.checked - continuity.ok} de ${continuity.checked} movimientos: revisa las columnas de débito/crédito o valor.`
    );
  }
  const parsedRatio = candidates === 0 ? 0 : movements.length / candidates;
  if (movements.length === 0) warnings.push("No se reconoció ningún movimiento con fecha y valor.");
  return { movements, warnings, parsedRatio, continuity };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Verifica saldo anterior + movimiento = saldo, en el orden del archivo o en
 * orden inverso (muchos bancos listan del más reciente al más antiguo). En
 * auxiliares con varias cuentas, la cadena se reinicia con cada cuenta.
 */
function checkContinuity(movements: Movement[], kind: SourceKind): { checked: number; ok: number } | null {
  const withSaldo = movements.filter((m) => m.saldo !== null);
  if (withSaldo.length < 2) return null;
  const run = (list: Movement[]) => {
    let checked = 0;
    let ok = 0;
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const cur = list[i];
      if (prev.saldo === null || cur.saldo === null || prev.cuenta !== cur.cuenta) continue;
      checked++;
      // Auxiliares de cuentas de naturaleza crédito llevan el saldo con signo contrario
      const delta = round2(cur.saldo - prev.saldo);
      if (Math.abs(delta - cur.valor) <= 1 || (kind === "auxiliar" && Math.abs(delta + cur.valor) <= 1)) ok++;
    }
    return { checked, ok };
  };
  const forward = run(withSaldo);
  const backward = run([...withSaldo].reverse());
  return backward.ok > forward.ok ? backward : forward;
}

// ---------------------------------------------------------------------------
// Extractos en PDF (texto extraído con pdf.js)
// ---------------------------------------------------------------------------

const LINE_DATE = /^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}(?:[-/.]\d{2,4})?|\d{1,2}[-/. ](?:ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)[a-z]*\.?(?:[-/. ]\d{2,4})?)\s+(.*)$/i;
const AMOUNT_TOKEN = /-?\(?\$?\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\)?-?|-?\d+[.,]\d{2}-?/g;

/**
 * Extractos en PDF: cada movimiento suele ser una línea "fecha descripción
 * valor saldo". El signo se deduce de la variación del saldo; si la línea no
 * trae saldo, del signo del valor. Devuelve confianza baja si el saldo no
 * cuadra, para que el servidor use la IA.
 */
export function parseStatementText(lines: string[], defaultYear: number): DetectionResult {
  const rows: Cell[][] = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    const m = line.match(LINE_DATE);
    if (!m) continue;
    const rest = m[2];
    const amounts = [...rest.matchAll(AMOUNT_TOKEN)].map((a) => a[0]).filter((a) => /\d[.,]\d{2}\b|\d{1,3}[.,]\d{3}/.test(a));
    if (amounts.length === 0) continue;
    const descEnd = rest.indexOf(amounts[0]);
    const descripcion = rest.slice(0, descEnd).trim();
    const valor = amounts.length >= 2 ? amounts[amounts.length - 2] : amounts[0];
    const saldo = amounts.length >= 2 ? amounts[amounts.length - 1] : null;
    rows.push([m[1], descripcion, valor, saldo]);
  }
  const table: Cell[][] = [["fecha", "descripcion", "valor", "saldo"], ...rows];
  const base: ColumnMapping = {
    headerRow: 0,
    columns: { fecha: 0, descripcion: 1, valor: 2, saldo: 3 },
    dateOrder: guessDateOrder(rows, 0),
  };

  // Signo por variación del saldo: más confiable que el signo impreso en el
  // PDF. Primero se averigua si el extracto va del más antiguo al más
  // reciente o al revés, comparando |variación del saldo| con |valor|.
  const parsed = applyMapping(table, base, "extracto", defaultYear);
  const ms = parsed.movements;
  const matches = (step: 1 | -1) => {
    let n = 0;
    for (let i = 0; i < ms.length; i++) {
      const other = ms[i - step];
      if (!other || ms[i].saldo === null || other.saldo === null) continue;
      if (Math.abs(Math.abs(ms[i].saldo! - other.saldo!) - Math.abs(ms[i].valor)) <= 1) n++;
    }
    return n;
  };
  const step: 1 | -1 = matches(-1) > matches(1) ? -1 : 1;
  let fixedBySaldo = 0;
  for (let i = 0; i < ms.length; i++) {
    const other = ms[i - step];
    if (!other || ms[i].saldo === null || other.saldo === null) continue;
    const delta = round2(ms[i].saldo! - other.saldo!);
    if (Math.abs(Math.abs(delta) - Math.abs(ms[i].valor)) <= 1 && delta !== 0 && Math.sign(delta) !== Math.sign(ms[i].valor)) {
      const abs = Math.abs(ms[i].valor);
      ms[i] = { ...ms[i], valor: delta > 0 ? abs : -abs, credito: delta > 0 ? abs : 0, debito: delta > 0 ? 0 : abs };
      fixedBySaldo++;
    }
  }
  const continuity = checkContinuity(ms, "extracto");
  let confidence = ms.length >= 2 ? 1 : 0;
  if (continuity && continuity.checked >= 3) confidence = continuity.ok / continuity.checked;
  else if (ms.length > 0) confidence = 0.5; // sin saldo no se puede verificar el signo
  // La advertencia de saldo de la primera lectura queda obsoleta tras corregir signos
  const warnings = parsed.warnings.filter((w) => !w.startsWith("El saldo no cuadra"));
  if (continuity && continuity.checked >= 3 && continuity.ok / continuity.checked < 0.9) {
    warnings.push(`El saldo no cuadra fila a fila en ${continuity.checked - continuity.ok} de ${continuity.checked} movimientos.`);
  }
  if (fixedBySaldo > 0) warnings.push(`${fixedBySaldo} movimientos tomaron su signo de la variación del saldo.`);
  return { mapping: base, confidence, outcome: { ...parsed, movements: ms, continuity, warnings } };
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Movimientos en orden cronológico (respeta el orden del archivo dentro de un mismo día). */
export function chronological(movements: Movement[]): Movement[] {
  const list = movements.length > 1 && movements[0].fecha > movements[movements.length - 1].fecha ? [...movements].reverse() : [...movements];
  return list.map((m, i) => ({ m, i })).sort((a, b) => a.m.fecha.localeCompare(b.m.fecha) || a.i - b.i).map((x) => x.m);
}

/** Saldo inicial y final deducidos de la columna de saldo, si existe. */
export function inferBalances(movements: Movement[]): { inicial: number | null; final: number | null } {
  const ordered = chronological(movements).filter((m) => m.saldo !== null);
  if (ordered.length === 0) return { inicial: null, final: null };
  const first = ordered[0];
  return { inicial: round2(first.saldo! - first.valor), final: ordered[ordered.length - 1].saldo };
}

/** Une los fragmentos de texto del PDF en líneas según su posición vertical. */
export function pdfItemsToLines(items: { text: string; x: number; y: number; page: number }[]): string[] {
  const lines: { page: number; y: number; parts: { x: number; text: string }[] }[] = [];
  for (const item of items) {
    const line = lines.find((l) => l.page === item.page && Math.abs(l.y - item.y) <= 2.5);
    if (line) line.parts.push({ x: item.x, text: item.text });
    else lines.push({ page: item.page, y: item.y, parts: [{ x: item.x, text: item.text }] });
  }
  return lines
    .sort((a, b) => a.page - b.page || b.y - a.y)
    .map((l) => l.parts.sort((a, b) => a.x - b.x).map((p) => p.text).join(" "));
}
