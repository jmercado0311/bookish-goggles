/**
 * Clasificación de cuentas del PUC colombiano (Decreto 2650 de 1993, que la
 * mayoría de software contable sigue usando como catálogo) en los rubros de
 * presentación de los estados financieros bajo NIIF (Decreto 2420 de 2015).
 *
 * La clasificación por defecto es un punto de partida: el contador puede
 * reclasificar cualquier cuenta desde la pestaña "Clasificación" (por
 * ejemplo, mover una obligación financiera a largo plazo).
 */

export type Section =
  | "activo_corriente"
  | "activo_no_corriente"
  | "pasivo_corriente"
  | "pasivo_no_corriente"
  | "patrimonio"
  | "resultados"
  | "excluido";

export type CashFlowCategory = "efectivo" | "operacion" | "inversion" | "financiacion" | "ninguno";

export interface Rubro {
  key: string;
  label: string;
  section: Section;
  /** credit: se presenta con el signo invertido (pasivos, patrimonio, ingresos). */
  nature: "debit" | "credit";
  cashflow: CashFlowCategory;
}

export const RUBROS: Rubro[] = [
  // Activo corriente
  { key: "efectivo", label: "Efectivo y equivalentes al efectivo", section: "activo_corriente", nature: "debit", cashflow: "efectivo" },
  { key: "inversiones_cp", label: "Inversiones e instrumentos financieros", section: "activo_corriente", nature: "debit", cashflow: "inversion" },
  { key: "deudores", label: "Deudores comerciales y otras cuentas por cobrar", section: "activo_corriente", nature: "debit", cashflow: "operacion" },
  { key: "impuestos_activo", label: "Activos por impuestos corrientes", section: "activo_corriente", nature: "debit", cashflow: "operacion" },
  { key: "inventarios", label: "Inventarios", section: "activo_corriente", nature: "debit", cashflow: "operacion" },
  { key: "otros_activos_cp", label: "Otros activos no financieros", section: "activo_corriente", nature: "debit", cashflow: "operacion" },
  // Activo no corriente
  { key: "deudores_lp", label: "Cuentas por cobrar a largo plazo", section: "activo_no_corriente", nature: "debit", cashflow: "inversion" },
  { key: "inversiones_lp", label: "Inversiones en asociadas, subsidiarias y otras", section: "activo_no_corriente", nature: "debit", cashflow: "inversion" },
  { key: "ppe", label: "Propiedades, planta y equipo", section: "activo_no_corriente", nature: "debit", cashflow: "inversion" },
  { key: "intangibles", label: "Activos intangibles", section: "activo_no_corriente", nature: "debit", cashflow: "inversion" },
  { key: "impuesto_diferido_activo", label: "Activo por impuesto diferido", section: "activo_no_corriente", nature: "debit", cashflow: "operacion" },
  { key: "otros_activos_lp", label: "Otros activos no corrientes", section: "activo_no_corriente", nature: "debit", cashflow: "inversion" },
  // Pasivo corriente
  { key: "obligaciones_financieras", label: "Obligaciones financieras", section: "pasivo_corriente", nature: "credit", cashflow: "financiacion" },
  { key: "proveedores_cxp", label: "Cuentas comerciales por pagar y otras cuentas por pagar", section: "pasivo_corriente", nature: "credit", cashflow: "operacion" },
  { key: "impuestos_pasivo", label: "Pasivos por impuestos corrientes", section: "pasivo_corriente", nature: "credit", cashflow: "operacion" },
  { key: "beneficios_empleados", label: "Beneficios a los empleados", section: "pasivo_corriente", nature: "credit", cashflow: "operacion" },
  { key: "provisiones", label: "Provisiones", section: "pasivo_corriente", nature: "credit", cashflow: "operacion" },
  { key: "otros_pasivos_cp", label: "Otros pasivos no financieros", section: "pasivo_corriente", nature: "credit", cashflow: "operacion" },
  // Pasivo no corriente
  { key: "obligaciones_financieras_lp", label: "Obligaciones financieras a largo plazo", section: "pasivo_no_corriente", nature: "credit", cashflow: "financiacion" },
  { key: "impuesto_diferido_pasivo", label: "Pasivo por impuesto diferido", section: "pasivo_no_corriente", nature: "credit", cashflow: "operacion" },
  { key: "otros_pasivos_lp", label: "Otros pasivos no corrientes", section: "pasivo_no_corriente", nature: "credit", cashflow: "financiacion" },
  // Patrimonio
  { key: "capital", label: "Capital emitido", section: "patrimonio", nature: "credit", cashflow: "financiacion" },
  { key: "prima", label: "Superávit de capital (prima en colocación)", section: "patrimonio", nature: "credit", cashflow: "financiacion" },
  { key: "reservas", label: "Reservas", section: "patrimonio", nature: "credit", cashflow: "financiacion" },
  { key: "otro_patrimonio", label: "Otras participaciones en el patrimonio", section: "patrimonio", nature: "credit", cashflow: "financiacion" },
  { key: "ori", label: "Otro resultado integral acumulado", section: "patrimonio", nature: "credit", cashflow: "inversion" },
  { key: "resultados_acumulados", label: "Ganancias acumuladas", section: "patrimonio", nature: "credit", cashflow: "financiacion" },
  { key: "resultado_ejercicio", label: "Resultado del ejercicio", section: "patrimonio", nature: "credit", cashflow: "financiacion" },
  // Resultados
  { key: "ingresos_ordinarios", label: "Ingresos de actividades ordinarias", section: "resultados", nature: "credit", cashflow: "ninguno" },
  { key: "costo_ventas", label: "Costo de ventas", section: "resultados", nature: "debit", cashflow: "ninguno" },
  { key: "gastos_admin", label: "Gastos de administración", section: "resultados", nature: "debit", cashflow: "ninguno" },
  { key: "gastos_ventas", label: "Gastos de ventas", section: "resultados", nature: "debit", cashflow: "ninguno" },
  { key: "otros_ingresos", label: "Otros ingresos", section: "resultados", nature: "credit", cashflow: "ninguno" },
  { key: "otros_gastos", label: "Otros gastos", section: "resultados", nature: "debit", cashflow: "ninguno" },
  { key: "ingresos_financieros", label: "Ingresos financieros", section: "resultados", nature: "credit", cashflow: "ninguno" },
  { key: "costos_financieros", label: "Costos financieros", section: "resultados", nature: "debit", cashflow: "ninguno" },
  { key: "impuesto_renta", label: "Gasto por impuesto a las ganancias", section: "resultados", nature: "debit", cashflow: "ninguno" },
  // Excluidas de los estados
  { key: "cierre", label: "Ganancias y pérdidas (cuenta de cierre)", section: "excluido", nature: "credit", cashflow: "ninguno" },
  { key: "orden", label: "Cuentas de orden", section: "excluido", nature: "debit", cashflow: "ninguno" },
  { key: "sin_clasificar", label: "Sin clasificar", section: "excluido", nature: "debit", cashflow: "ninguno" },
];

export const RUBRO_BY_KEY = new Map(RUBROS.map((r) => [r.key, r]));

/** Reglas por prefijo; gana el prefijo más largo que coincida. */
const PREFIX_RULES: [string, string][] = [
  ["11", "efectivo"],
  ["12", "inversiones_cp"],
  ["1205", "inversiones_lp"], // acciones
  ["1210", "inversiones_lp"], // cuotas o partes de interés social
  ["13", "deudores"],
  ["1355", "impuestos_activo"], // anticipo de impuestos y contribuciones o saldos a favor
  ["14", "inventarios"],
  ["15", "ppe"],
  ["16", "intangibles"],
  ["17", "otros_activos_cp"], // gastos pagados por anticipado / diferidos
  ["171076", "impuesto_diferido_activo"],
  ["18", "otros_activos_lp"],
  ["19", "otros_activos_lp"], // valorizaciones: no proceden bajo NIIF (ver advertencias)
  ["21", "obligaciones_financieras"],
  ["22", "proveedores_cxp"],
  ["23", "proveedores_cxp"],
  ["24", "impuestos_pasivo"],
  ["25", "beneficios_empleados"],
  ["26", "provisiones"],
  ["2610", "beneficios_empleados"], // para obligaciones laborales
  ["2615", "impuestos_pasivo"], // para obligaciones fiscales
  ["27", "otros_pasivos_cp"],
  ["2725", "impuesto_diferido_pasivo"],
  ["28", "otros_pasivos_cp"],
  ["29", "otros_pasivos_lp"], // bonos y papeles comerciales
  ["31", "capital"],
  ["32", "prima"],
  ["33", "reservas"],
  ["34", "otro_patrimonio"], // revalorización del patrimonio
  ["35", "otro_patrimonio"], // dividendos decretados en acciones
  ["36", "resultado_ejercicio"],
  ["37", "resultados_acumulados"],
  ["38", "ori"], // superávit por valorizaciones
  ["41", "ingresos_ordinarios"],
  ["42", "otros_ingresos"],
  ["4210", "ingresos_financieros"],
  ["47", "otros_ingresos"],
  ["51", "gastos_admin"],
  ["52", "gastos_ventas"],
  ["53", "otros_gastos"],
  ["5305", "costos_financieros"],
  ["54", "impuesto_renta"],
  ["59", "cierre"],
  ["6", "costo_ventas"],
  ["7", "costo_ventas"],
  ["8", "orden"],
  ["9", "orden"],
];

export function classifyAccount(code: string): string {
  let best: [string, string] | null = null;
  for (const rule of PREFIX_RULES) {
    if (code.startsWith(rule[0]) && (!best || rule[0].length > best[0].length)) best = rule;
  }
  return best ? best[1] : "sin_clasificar";
}

/** Cuentas correctoras sin efecto en el efectivo (se suman en el flujo de efectivo). */
const NON_CASH_CONTRA_PREFIXES = ["1592", "1596", "1597", "1598", "1599", "1698", "1699", "1399", "1499", "1299", "1798", "1899"];

export function isNonCashContra(code: string): boolean {
  return NON_CASH_CONTRA_PREFIXES.some((p) => code.startsWith(p));
}

/** Gasto por depreciación, amortización y deterioro (para EBITDA). */
const DEPRECIATION_EXPENSE_PREFIXES = ["5160", "5165", "5260", "5265", "5199", "5299"];

export function isDepreciationExpense(code: string): boolean {
  return DEPRECIATION_EXPENSE_PREFIXES.some((p) => code.startsWith(p));
}

/**
 * Cuentas cuyo saldo normal es crédito. Se usa solo para corregir el signo
 * de archivos que presentan todos los saldos en positivo ("según naturaleza")
 * cuando una fila no trae movimientos que permitan deducirlo.
 */
export function isCreditNatureAccount(code: string): boolean {
  if (["2", "3", "4"].includes(code[0])) return !code.startsWith("4175"); // devoluciones en ventas: débito
  if (code.startsWith("59")) return true;
  return NON_CASH_CONTRA_PREFIXES.some((p) => code.startsWith(p));
}
