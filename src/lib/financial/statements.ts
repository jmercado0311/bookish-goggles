import { RUBROS, RUBRO_BY_KEY, isDepreciationExpense, isNonCashContra, type Section } from "./puc-mapping";

/**
 * Estados financieros básicos (NIC 1 / Sección 3 NIIF para PYMES) a partir
 * de las líneas del balance de prueba:
 * - Estado de situación financiera (comparativo: saldo final vs. anterior)
 * - Estado de resultados integral (movimiento del periodo; comparativo si
 *   existe el balance de prueba del periodo anterior)
 * - Estado de cambios en el patrimonio
 * - Estado de flujos de efectivo, método indirecto (por variación de saldos)
 *
 * Convención interna: saldo con signo, positivo = débito.
 */

export interface TBLine {
  account_code: string;
  account_name: string;
  saldo_anterior: number;
  saldo_final: number;
  rubro: string;
}

export interface StatementLine {
  key: string;
  label: string;
  current: number;
  previous: number | null;
  /** Nivel visual: 0 = rubro, 1 = subtotal, 2 = total. */
  level: 0 | 1 | 2;
}

const num = (v: unknown) => Number(v) || 0;

/** Valor de presentación del rubro (positivo en su naturaleza). */
function presented(lines: TBLine[], rubro: string, column: "saldo_final" | "saldo_anterior"): number {
  const r = RUBRO_BY_KEY.get(rubro);
  const sum = lines.filter((l) => l.rubro === rubro).reduce((s, l) => s + num(l[column]), 0);
  return r?.nature === "credit" ? -sum : sum;
}

function movement(lines: TBLine[], rubro: string): number {
  const r = RUBRO_BY_KEY.get(rubro);
  const sum = lines.filter((l) => l.rubro === rubro).reduce((s, l) => s + num(l.saldo_final) - num(l.saldo_anterior), 0);
  return r?.nature === "credit" ? -sum : sum;
}

const rubrosOf = (section: Section) => RUBROS.filter((r) => r.section === section);

// ---------------------------------------------------------------------------
// Estado de resultados
// ---------------------------------------------------------------------------

export interface IncomeStatement {
  ingresos: number;
  costo_ventas: number;
  utilidad_bruta: number;
  gastos_admin: number;
  gastos_ventas: number;
  otros_ingresos: number;
  otros_gastos: number;
  utilidad_operacional: number;
  ingresos_financieros: number;
  costos_financieros: number;
  utilidad_antes_impuestos: number;
  impuesto_renta: number;
  utilidad_neta: number;
  depreciacion: number;
  /** true si las clases 4 a 7 ya se cerraron contra el patrimonio. */
  cerrado: boolean;
}

export function incomeStatement(lines: TBLine[]): IncomeStatement {
  const resultLines = lines.filter((l) => RUBRO_BY_KEY.get(l.rubro)?.section === "resultados");
  const cerrado =
    resultLines.every((l) => num(l.saldo_final) === 0 && num(l.saldo_anterior) === 0);

  const m = (rubro: string) => movement(lines, rubro);
  const ingresos = m("ingresos_ordinarios");
  const costo_ventas = m("costo_ventas");
  const utilidad_bruta = ingresos - costo_ventas;
  const gastos_admin = m("gastos_admin");
  const gastos_ventas = m("gastos_ventas");
  const otros_ingresos = m("otros_ingresos");
  const otros_gastos = m("otros_gastos");
  const utilidad_operacional = utilidad_bruta - gastos_admin - gastos_ventas + otros_ingresos - otros_gastos;
  const ingresos_financieros = m("ingresos_financieros");
  const costos_financieros = m("costos_financieros");
  const utilidad_antes_impuestos = utilidad_operacional + ingresos_financieros - costos_financieros;
  const impuesto_renta = m("impuesto_renta");
  let utilidad_neta = utilidad_antes_impuestos - impuesto_renta;

  // Balance ya cerrado: el resultado solo se conoce por la cuenta 36
  if (cerrado) utilidad_neta = presented(lines, "resultado_ejercicio", "saldo_final");

  const depreciacion = resultLines
    .filter((l) => isDepreciationExpense(l.account_code))
    .reduce((s, l) => s + num(l.saldo_final) - num(l.saldo_anterior), 0);

  return {
    ingresos,
    costo_ventas,
    utilidad_bruta,
    gastos_admin,
    gastos_ventas,
    otros_ingresos,
    otros_gastos,
    utilidad_operacional,
    ingresos_financieros,
    costos_financieros,
    utilidad_antes_impuestos,
    impuesto_renta,
    utilidad_neta,
    depreciacion,
    cerrado,
  };
}

export function incomeStatementLines(cur: IncomeStatement, prev: IncomeStatement | null): StatementLine[] {
  const row = (key: keyof IncomeStatement, label: string, level: 0 | 1 | 2 = 0): StatementLine => ({
    key,
    label,
    current: cur[key] as number,
    previous: prev ? (prev[key] as number) : null,
    level,
  });
  return [
    row("ingresos", "Ingresos de actividades ordinarias"),
    row("costo_ventas", "Costo de ventas"),
    row("utilidad_bruta", "Ganancia bruta", 1),
    row("gastos_admin", "Gastos de administración"),
    row("gastos_ventas", "Gastos de ventas"),
    row("otros_ingresos", "Otros ingresos"),
    row("otros_gastos", "Otros gastos"),
    row("utilidad_operacional", "Resultado de actividades de operación", 1),
    row("ingresos_financieros", "Ingresos financieros"),
    row("costos_financieros", "Costos financieros"),
    row("utilidad_antes_impuestos", "Resultado antes de impuestos", 1),
    row("impuesto_renta", "Gasto por impuesto a las ganancias"),
    row("utilidad_neta", "Resultado del ejercicio", 2),
  ];
}

// ---------------------------------------------------------------------------
// Estado de situación financiera
// ---------------------------------------------------------------------------

export interface BalanceSheetTotals {
  activo_corriente: number;
  activo_no_corriente: number;
  activo_total: number;
  pasivo_corriente: number;
  pasivo_no_corriente: number;
  pasivo_total: number;
  patrimonio: number;
  /** Resultado del ejercicio que se presenta dentro del patrimonio. */
  resultado: number;
  rubros: Record<string, number>;
}

function balanceSheetColumn(lines: TBLine[], column: "saldo_final" | "saldo_anterior"): BalanceSheetTotals {
  const rubros: Record<string, number> = {};
  for (const r of RUBROS) {
    if (["activo_corriente", "activo_no_corriente", "pasivo_corriente", "pasivo_no_corriente", "patrimonio"].includes(r.section)) {
      rubros[r.key] = presented(lines, r.key, column);
    }
  }

  // Si las clases 4-7 tienen saldo, el resultado aún no está cerrado: se
  // presenta como resultado del ejercicio y lo que haya en la 36 (resultado
  // del año anterior sin trasladar) pasa a ganancias acumuladas.
  const resultsBalance = -lines
    .filter((l) => RUBRO_BY_KEY.get(l.rubro)?.section === "resultados")
    .reduce((s, l) => s + num(l[column]), 0);
  const open = lines.some((l) => RUBRO_BY_KEY.get(l.rubro)?.section === "resultados" && num(l[column]) !== 0);
  if (open) {
    rubros.resultados_acumulados += rubros.resultado_ejercicio;
    rubros.resultado_ejercicio = resultsBalance;
  }

  const sum = (section: Section) => rubrosOf(section).reduce((s, r) => s + (rubros[r.key] ?? 0), 0);
  const activo_corriente = sum("activo_corriente");
  const activo_no_corriente = sum("activo_no_corriente");
  const pasivo_corriente = sum("pasivo_corriente");
  const pasivo_no_corriente = sum("pasivo_no_corriente");
  const patrimonio = sum("patrimonio");

  return {
    activo_corriente,
    activo_no_corriente,
    activo_total: activo_corriente + activo_no_corriente,
    pasivo_corriente,
    pasivo_no_corriente,
    pasivo_total: pasivo_corriente + pasivo_no_corriente,
    patrimonio,
    resultado: rubros.resultado_ejercicio,
    rubros,
  };
}

export interface BalanceSheet {
  current: BalanceSheetTotals;
  previous: BalanceSheetTotals;
  lines: StatementLine[];
  /** Activo - (pasivo + patrimonio); debe ser 0. */
  descuadre: number;
}

export function balanceSheet(lines: TBLine[]): BalanceSheet {
  const current = balanceSheetColumn(lines, "saldo_final");
  const previous = balanceSheetColumn(lines, "saldo_anterior");
  const out: StatementLine[] = [];

  const section = (sec: Section, title: string, totalKey: keyof BalanceSheetTotals) => {
    for (const r of rubrosOf(sec)) {
      const c = current.rubros[r.key] ?? 0;
      const p = previous.rubros[r.key] ?? 0;
      if (c !== 0 || p !== 0) out.push({ key: r.key, label: r.label, current: c, previous: p, level: 0 });
    }
    out.push({ key: totalKey, label: title, current: current[totalKey] as number, previous: previous[totalKey] as number, level: 1 });
  };

  section("activo_corriente", "Total activo corriente", "activo_corriente");
  section("activo_no_corriente", "Total activo no corriente", "activo_no_corriente");
  out.push({ key: "activo_total", label: "TOTAL ACTIVO", current: current.activo_total, previous: previous.activo_total, level: 2 });
  section("pasivo_corriente", "Total pasivo corriente", "pasivo_corriente");
  section("pasivo_no_corriente", "Total pasivo no corriente", "pasivo_no_corriente");
  out.push({ key: "pasivo_total", label: "TOTAL PASIVO", current: current.pasivo_total, previous: previous.pasivo_total, level: 2 });
  section("patrimonio", "TOTAL PATRIMONIO", "patrimonio");
  out.push({
    key: "pasivo_patrimonio",
    label: "TOTAL PASIVO Y PATRIMONIO",
    current: current.pasivo_total + current.patrimonio,
    previous: previous.pasivo_total + previous.patrimonio,
    level: 2,
  });

  return {
    current,
    previous,
    lines: out,
    descuadre: Math.round((current.activo_total - current.pasivo_total - current.patrimonio) * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Estado de cambios en el patrimonio
// ---------------------------------------------------------------------------

export const EQUITY_COLUMNS = [
  { key: "capital", label: "Capital" },
  { key: "prima", label: "Superávit de capital" },
  { key: "reservas", label: "Reservas" },
  { key: "otro_patrimonio", label: "Otras participaciones" },
  { key: "ori", label: "ORI" },
  { key: "resultados_acumulados", label: "Ganancias acumuladas" },
  { key: "resultado_ejercicio", label: "Resultado del ejercicio" },
] as const;

export interface EquityChanges {
  rows: { label: string; values: number[]; total: number }[];
}

export function equityChanges(bs: BalanceSheet, income: IncomeStatement): EquityChanges {
  const cols = EQUITY_COLUMNS.map((c) => c.key);
  const inicial = cols.map((k) => bs.previous.rubros[k] ?? 0);
  const final = cols.map((k) => bs.current.rubros[k] ?? 0);

  const resultado = cols.map((k) => (k === "resultado_ejercicio" ? income.utilidad_neta : 0));
  const ori = cols.map((k, i) => (k === "ori" ? final[i] - inicial[i] : 0));
  const otros = cols.map((_, i) => final[i] - inicial[i] - resultado[i] - ori[i]);

  const total = (v: number[]) => v.reduce((s, x) => s + x, 0);
  return {
    rows: [
      { label: "Saldo al inicio del periodo", values: inicial, total: total(inicial) },
      { label: "Resultado del ejercicio", values: resultado, total: total(resultado) },
      { label: "Otro resultado integral", values: ori, total: total(ori) },
      { label: "Traslados, apropiaciones, dividendos y otros movimientos", values: otros, total: total(otros) },
      { label: "Saldo al final del periodo", values: final, total: total(final) },
    ],
  };
}

// ---------------------------------------------------------------------------
// Estado de flujos de efectivo (método indirecto)
// ---------------------------------------------------------------------------

export interface CashFlow {
  operacion: { label: string; value: number }[];
  total_operacion: number;
  inversion: { label: string; value: number }[];
  total_inversion: number;
  financiacion: { label: string; value: number }[];
  total_financiacion: number;
  variacion_neta: number;
  efectivo_inicial: number;
  efectivo_final: number;
  /** Diferencia contra la variación real del efectivo; debe ser 0. */
  diferencia: number;
}

export function cashFlow(lines: TBLine[], income: IncomeStatement, bs: BalanceSheet): CashFlow {
  const groups = { operacion: new Map<string, number>(), inversion: new Map<string, number>(), financiacion: new Map<string, number>() };
  let noMonetarias = 0;

  for (const l of lines) {
    const r = RUBRO_BY_KEY.get(l.rubro);
    if (!r || r.section === "resultados" || r.section === "excluido" || r.cashflow === "efectivo" || r.cashflow === "ninguno") continue;
    // Un aumento de un saldo débito (activo) consume efectivo y viceversa
    const effect = -(num(l.saldo_final) - num(l.saldo_anterior));
    if (isNonCashContra(l.account_code)) {
      noMonetarias += effect;
      continue;
    }
    const target = groups[r.cashflow];
    target.set(r.key, (target.get(r.key) ?? 0) + effect);
  }

  // El resultado del ejercicio entra por operación. En la 36/37 se descuenta
  // para no contarlo dos veces cuando el balance ya está cerrado.
  const patrimonioResultado =
    (groups.financiacion.get("resultado_ejercicio") ?? 0) + (groups.financiacion.get("resultados_acumulados") ?? 0);
  groups.financiacion.delete("resultado_ejercicio");
  groups.financiacion.delete("resultados_acumulados");
  const resultadoEnPatrimonio = income.cerrado ? income.utilidad_neta : 0;
  const distribuciones = patrimonioResultado - resultadoEnPatrimonio;

  const label = (key: string, prefix: string) => `${prefix} ${RUBRO_BY_KEY.get(key)?.label.toLowerCase()}`;
  const toList = (m: Map<string, number>, describe: (k: string, v: number) => string) =>
    [...m.entries()].filter(([, v]) => Math.round(v) !== 0).map(([k, v]) => ({ label: describe(k, v), value: v }));

  const operacion = [
    { label: "Resultado del ejercicio", value: income.utilidad_neta },
    ...(Math.round(noMonetarias) !== 0
      ? [{ label: "Depreciaciones, amortizaciones y deterioro (no monetarias)", value: noMonetarias }]
      : []),
    ...toList(groups.operacion, (k, v) => label(k, v >= 0 ? "Variación (disminución activo / aumento pasivo) en" : "Variación (aumento activo / disminución pasivo) en")),
  ];
  const inversion = toList(groups.inversion, (k, v) => label(k, v >= 0 ? "Disminución (venta/retiro) de" : "Adquisición / aumento de"));
  const financiacion = [
    ...toList(groups.financiacion, (k, v) => label(k, v >= 0 ? "Aumento de" : "Disminución de")),
    ...(Math.round(distribuciones) !== 0
      ? [{ label: "Dividendos, participaciones y otros movimientos de resultados acumulados", value: distribuciones }]
      : []),
  ];

  const total = (list: { value: number }[]) => list.reduce((s, x) => s + x.value, 0);
  const total_operacion = total(operacion);
  const total_inversion = total(inversion);
  const total_financiacion = total(financiacion);
  const variacion_neta = total_operacion + total_inversion + total_financiacion;
  const efectivo_inicial = bs.previous.rubros.efectivo ?? 0;
  const efectivo_final = bs.current.rubros.efectivo ?? 0;

  return {
    operacion,
    total_operacion,
    inversion,
    total_inversion,
    financiacion,
    total_financiacion,
    variacion_neta,
    efectivo_inicial,
    efectivo_final,
    diferencia: Math.round((efectivo_final - efectivo_inicial - variacion_neta) * 100) / 100,
  };
}

/** Suma de saldos (presentados como positivos para cuentas débito) por prefijo de código. */
export function sumByPrefix(lines: TBLine[], prefix: string, column: "saldo_final" | "saldo_anterior"): number {
  return lines.filter((l) => l.account_code.startsWith(prefix)).reduce((s, l) => s + num(l[column]), 0);
}
