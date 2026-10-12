/**
 * Conciliación bancaria automática entre el extracto y el auxiliar de la
 * cuenta de bancos. Ambos lados usan `valor` desde la perspectiva de la
 * empresa (positivo = entra dinero), así que una partida conciliada tiene el
 * mismo valor en los dos lados.
 */

export interface RecMovement {
  id: string;
  fecha: string;
  descripcion: string;
  documento: string;
  tercero?: string;
  valor: number;
}

export type MatchType = "exacto" | "fecha_cercana" | "agrupado" | "manual";

export interface Match {
  bank: string[];
  ledger: string[];
  type: MatchType;
}

export interface Suggestion {
  concepto: string;
  /** Cuenta PUC sugerida a nivel de cuenta (4 dígitos); el contador elige la subcuenta. */
  cuenta: string | null;
  nota: string;
}

export interface UnmatchedItem {
  movement: RecMovement;
  side: "banco" | "libros";
  categoria:
    | "nota_debito"
    | "nota_credito"
    | "cheque_pendiente"
    | "egreso_pendiente"
    | "consignacion_transito";
  suggestion: Suggestion;
  /** Partida con más de 30 días frente al corte: requiere seguimiento. */
  antigua: boolean;
  /** Posible pareja con el mismo documento pero distinto valor (error de digitación). */
  posibleDiferencia?: { id: string; valor: number };
}

export interface ReconciliationSummary {
  saldoExtracto: number;
  consignacionesTransito: number;
  chequesPendientes: number;
  saldoExtractoAjustado: number;
  saldoLibros: number;
  notasCredito: number;
  notasDebito: number;
  saldoLibrosAjustado: number;
  diferencia: number;
}

const DAY = 86400000;
const days = (a: string, b: string) => Math.round(Math.abs(Date.parse(a) - Date.parse(b)) / DAY);
const cents = (n: number) => Math.round(n * 100);

/** Números de 3 o más dígitos en documento y descripción (cheques, comprobantes, referencias). */
function refs(m: RecMovement): Set<string> {
  const out = new Set<string>();
  for (const n of `${m.documento} ${m.descripcion}`.match(/\d{3,}/g) ?? []) out.add(n.replace(/^0+/, ""));
  return out;
}

function sharesRef(a: RecMovement, b: RecMovement): boolean {
  const ra = refs(a);
  for (const r of refs(b)) if (r && ra.has(r)) return true;
  return false;
}

export function autoMatch(bank: RecMovement[], ledger: RecMovement[], toleranceDays = 5): Match[] {
  const matches: Match[] = [];
  const usedBank = new Set<string>();
  const usedLedger = new Set<string>();

  // 1. Mismo valor, fecha dentro de la tolerancia; gana el par más cercano y con referencia común
  const pairs: { b: RecMovement; l: RecMovement; score: number; d: number }[] = [];
  const ledgerByAmount = new Map<number, RecMovement[]>();
  for (const l of ledger) {
    const k = cents(l.valor);
    ledgerByAmount.set(k, [...(ledgerByAmount.get(k) ?? []), l]);
  }
  for (const b of bank) {
    for (const l of ledgerByAmount.get(cents(b.valor)) ?? []) {
      const d = days(b.fecha, l.fecha);
      if (d > toleranceDays) continue;
      pairs.push({ b, l, d, score: (sharesRef(b, l) ? 10 : 0) + (toleranceDays - d) });
    }
  }
  pairs.sort((x, y) => y.score - x.score || x.d - y.d);
  for (const p of pairs) {
    if (usedBank.has(p.b.id) || usedLedger.has(p.l.id)) continue;
    usedBank.add(p.b.id);
    usedLedger.add(p.l.id);
    matches.push({ bank: [p.b.id], ledger: [p.l.id], type: p.d === 0 ? "exacto" : "fecha_cercana" });
  }

  // 2. Agrupadas: una partida de un lado contra 2 a 4 del otro, mismo signo y fechas cercanas
  const group = (singles: RecMovement[], many: RecMovement[], usedS: Set<string>, usedM: Set<string>, singleIsBank: boolean) => {
    for (const s of singles) {
      if (usedS.has(s.id)) continue;
      const pool = many
        .filter((m) => !usedM.has(m.id) && Math.sign(m.valor) === Math.sign(s.valor) && days(m.fecha, s.fecha) <= toleranceDays)
        .filter((m) => Math.abs(m.valor) < Math.abs(s.valor))
        .sort((a, b) => days(a.fecha, s.fecha) - days(b.fecha, s.fecha))
        .slice(0, 14);
      const found = subsetSum(pool, cents(s.valor));
      if (found) {
        usedS.add(s.id);
        for (const m of found) usedM.add(m.id);
        matches.push(
          singleIsBank
            ? { bank: [s.id], ledger: found.map((m) => m.id), type: "agrupado" }
            : { bank: found.map((m) => m.id), ledger: [s.id], type: "agrupado" }
        );
      }
    }
  };
  group(bank, ledger, usedBank, usedLedger, true);
  group(ledger, bank, usedLedger, usedBank, false);

  return matches;
}

function subsetSum(pool: RecMovement[], target: number): RecMovement[] | null {
  const values = pool.map((m) => cents(m.valor));
  const pick: number[] = [];
  const search = (start: number, sum: number): boolean => {
    if (pick.length >= 2 && sum === target) return true;
    if (pick.length === 4) return false;
    for (let i = start; i < pool.length; i++) {
      pick.push(i);
      if (search(i + 1, sum + values[i])) return true;
      pick.pop();
    }
    return false;
  };
  return search(0, 0) ? pick.map((i) => pool[i]) : null;
}

// ---------------------------------------------------------------------------
// Clasificación de partidas conciliatorias
// ---------------------------------------------------------------------------

const BANK_RULES: { test: RegExp; sign?: 1 | -1; suggestion: Suggestion }[] = [
  {
    test: /4\s?x\s?1\.?000|gmf|gravamen|impto\.?\s*gobierno|imp\.?\s*gob/i,
    sign: -1,
    suggestion: { concepto: "Gravamen a los movimientos financieros (4x1000)", cuenta: "5115", nota: "Deducible en renta el 50 % del GMF certificado (art. 115 E.T.)." },
  },
  {
    test: /retenci|rte\.?\s*f|retefuente|rete\s*fuente/i,
    sign: -1,
    suggestion: { concepto: "Retención en la fuente practicada por el banco", cuenta: "1355", nota: "Anticipo de impuestos; solicite el certificado de retención." },
  },
  {
    test: /inter[eé]s|rendimiento/i,
    sign: 1,
    suggestion: { concepto: "Rendimientos financieros abonados", cuenta: "4210", nota: "Ingreso financiero; verifique la retención asociada." },
  },
  {
    test: /inter[eé]s|sobregiro|mora/i,
    sign: -1,
    suggestion: { concepto: "Intereses cobrados por el banco", cuenta: "5305", nota: "Gasto financiero." },
  },
  {
    test: /comisi|cuota\s*(de\s*)?manejo|chequera|servicio|cobro|iva\s*com|transacci[oó]n\s*interbancaria|ach|portal|token|tarjeta/i,
    sign: -1,
    suggestion: { concepto: "Comisiones y gastos bancarios", cuenta: "5305", nota: "Incluya el IVA de la comisión si el banco lo discrimina (descontable si aplica)." },
  },
  {
    test: /devoluci|revers|anulaci|rechaz/i,
    suggestion: { concepto: "Reverso o devolución del banco", cuenta: null, nota: "Identifique la operación original antes de registrar." },
  },
];

function classifyBank(m: RecMovement): Suggestion {
  const sign = m.valor >= 0 ? 1 : -1;
  for (const rule of BANK_RULES) {
    if ((!rule.sign || rule.sign === sign) && rule.test.test(`${m.descripcion} ${m.documento}`)) return rule.suggestion;
  }
  return sign > 0
    ? { concepto: "Consignación o transferencia no identificada", cuenta: "2805", nota: "Identifique el tercero; mientras tanto, regístrela como anticipo recibido." }
    : { concepto: "Débito bancario no registrado en libros", cuenta: null, nota: "Solicite el soporte al banco e identifique el concepto." };
}

export function classifyUnmatched(
  bank: RecMovement[],
  ledger: RecMovement[],
  matches: Match[],
  periodEnd: string
): UnmatchedItem[] {
  const matchedBank = new Set(matches.flatMap((m) => m.bank));
  const matchedLedger = new Set(matches.flatMap((m) => m.ledger));
  const freeBank = bank.filter((b) => !matchedBank.has(b.id));
  const freeLedger = ledger.filter((l) => !matchedLedger.has(l.id));
  const old = (m: RecMovement) => days(m.fecha, periodEnd) > 30;

  const items: UnmatchedItem[] = [];
  for (const b of freeBank) {
    const twin = freeLedger.find((l) => Math.sign(l.valor) === Math.sign(b.valor) && sharesRef(b, l));
    items.push({
      movement: b,
      side: "banco",
      categoria: b.valor >= 0 ? "nota_credito" : "nota_debito",
      suggestion: classifyBank(b),
      antigua: old(b),
      posibleDiferencia: twin ? { id: twin.id, valor: twin.valor } : undefined,
    });
  }
  for (const l of freeLedger) {
    const isCheque = /cheque|ch\.?\s*\d|chq/i.test(`${l.descripcion} ${l.documento}`);
    items.push({
      movement: l,
      side: "libros",
      categoria: l.valor >= 0 ? "consignacion_transito" : isCheque ? "cheque_pendiente" : "egreso_pendiente",
      suggestion:
        l.valor >= 0
          ? { concepto: "Consignación en tránsito", cuenta: null, nota: "Registrada en libros y aún no abonada por el banco; debe aparecer en el extracto siguiente." }
          : isCheque
            ? { concepto: "Cheque girado pendiente de cobro", cuenta: null, nota: "Si supera seis meses sin cobrarse, evalúe su reversión contra el pasivo." }
            : { concepto: "Egreso registrado no debitado por el banco", cuenta: null, nota: "Verifique que la transferencia se haya ejecutado." },
      antigua: old(l),
    });
  }
  return items;
}

export function summarize(items: UnmatchedItem[], saldoExtracto: number, saldoLibros: number): ReconciliationSummary {
  const sum = (cat: UnmatchedItem["categoria"][]) =>
    items.filter((i) => cat.includes(i.categoria)).reduce((s, i) => s + Math.abs(i.movement.valor), 0);
  const consignacionesTransito = sum(["consignacion_transito"]);
  const chequesPendientes = sum(["cheque_pendiente", "egreso_pendiente"]);
  const notasCredito = sum(["nota_credito"]);
  const notasDebito = sum(["nota_debito"]);
  const saldoExtractoAjustado = saldoExtracto + consignacionesTransito - chequesPendientes;
  const saldoLibrosAjustado = saldoLibros + notasCredito - notasDebito;
  return {
    saldoExtracto,
    consignacionesTransito,
    chequesPendientes,
    saldoExtractoAjustado,
    saldoLibros,
    notasCredito,
    notasDebito,
    saldoLibrosAjustado,
    diferencia: Math.round((saldoExtractoAjustado - saldoLibrosAjustado) * 100) / 100,
  };
}
