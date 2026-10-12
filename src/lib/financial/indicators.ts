import type { BalanceSheetTotals, IncomeStatement, TBLine } from "./statements";
import { sumByPrefix } from "./statements";

/**
 * Indicadores financieros con interpretación automática. Los umbrales son
 * referencias generales de análisis financiero; el contador debe ajustar la
 * lectura al sector y a la realidad de cada empresa.
 */

export type IndicatorUnit = "veces" | "porcentaje" | "pesos" | "dias";
export type IndicatorGroup = "Liquidez" | "Endeudamiento" | "Rentabilidad" | "Actividad" | "Requisitos habilitantes (RUP)";
export type Tone = "bueno" | "alerta" | "riesgo" | "neutro";

export interface Indicator {
  key: string;
  group: IndicatorGroup;
  name: string;
  formula: string;
  unit: IndicatorUnit;
  current: number | null;
  previous: number | null;
  tone: Tone;
  interpretation: string;
}

const div = (a: number, b: number) => (b === 0 ? null : a / b);

export function formatIndicator(value: number | null, unit: IndicatorUnit): string {
  if (value === null || !Number.isFinite(value)) return "N/A";
  switch (unit) {
    case "porcentaje":
      return `${(value * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`;
    case "pesos":
      return value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
    case "dias":
      return `${Math.round(value).toLocaleString("es-CO")} días`;
    default:
      return `${value.toLocaleString("es-CO", { maximumFractionDigits: 2 })} veces`;
  }
}

function trend(cur: number | null, prev: number | null, higherIsBetter: boolean): string {
  if (cur === null || prev === null || prev === 0) return "";
  const change = (cur - prev) / Math.abs(prev);
  if (Math.abs(change) < 0.03) return " Se mantiene estable frente al periodo anterior.";
  const improved = higherIsBetter ? change > 0 : change < 0;
  return ` ${improved ? "Mejora" : "Desmejora"} frente al periodo anterior (${change > 0 ? "+" : ""}${(change * 100).toFixed(1)} %).`;
}

export interface IndicatorInput {
  bs: BalanceSheetTotals;
  bsPrev: BalanceSheetTotals;
  income: IncomeStatement;
  incomePrev: IncomeStatement | null;
  lines: TBLine[];
}

export function computeIndicators({ bs, bsPrev, income, incomePrev, lines }: IndicatorInput): Indicator[] {
  const out: Indicator[] = [];
  const pct = (v: number | null) => (v === null ? "" : `${(v * 100).toFixed(1)} %`);
  const x = (v: number | null) => (v === null ? "" : v.toFixed(2));

  // ---------------- Liquidez ----------------
  const rc = div(bs.activo_corriente, bs.pasivo_corriente);
  const rcPrev = div(bsPrev.activo_corriente, bsPrev.pasivo_corriente);
  out.push({
    key: "razon_corriente",
    group: "Liquidez",
    name: "Razón corriente",
    formula: "Activo corriente / Pasivo corriente",
    unit: "veces",
    current: rc,
    previous: rcPrev,
    tone: rc === null ? "neutro" : rc >= 1.5 ? "bueno" : rc >= 1 ? "alerta" : "riesgo",
    interpretation:
      (rc === null
        ? "No hay pasivo corriente: la empresa no tiene obligaciones de corto plazo."
        : rc >= 1
          ? `Por cada peso de deuda a corto plazo la empresa cuenta con $${x(rc)} de activos corrientes para respaldarla.`
          : `La empresa solo tiene $${x(rc)} de activo corriente por cada peso que debe a corto plazo: hay riesgo de iliquidez y podría necesitar financiación o capitalización.`) +
      trend(rc, rcPrev, true),
  });

  const inv = bs.rubros.inventarios ?? 0;
  const pa = div(bs.activo_corriente - inv, bs.pasivo_corriente);
  const paPrev = div(bsPrev.activo_corriente - (bsPrev.rubros.inventarios ?? 0), bsPrev.pasivo_corriente);
  out.push({
    key: "prueba_acida",
    group: "Liquidez",
    name: "Prueba ácida",
    formula: "(Activo corriente - Inventarios) / Pasivo corriente",
    unit: "veces",
    current: pa,
    previous: paPrev,
    tone: pa === null ? "neutro" : pa >= 1 ? "bueno" : pa >= 0.7 ? "alerta" : "riesgo",
    interpretation:
      (pa === null
        ? "Sin pasivo corriente."
        : pa >= 1
          ? `Sin vender inventarios, la empresa puede cubrir sus deudas de corto plazo ($${x(pa)} por cada peso).`
          : `Sin vender inventarios la empresa cubre solo el ${pct(pa)} de sus obligaciones de corto plazo; depende de la rotación del inventario para pagar.`) +
      trend(pa, paPrev, true),
  });

  const ct = bs.activo_corriente - bs.pasivo_corriente;
  const ctPrev = bsPrev.activo_corriente - bsPrev.pasivo_corriente;
  out.push({
    key: "capital_trabajo",
    group: "Liquidez",
    name: "Capital de trabajo neto",
    formula: "Activo corriente - Pasivo corriente",
    unit: "pesos",
    current: ct,
    previous: ctPrev,
    tone: ct > 0 ? "bueno" : "riesgo",
    interpretation:
      (ct > 0
        ? "Después de cubrir las deudas de corto plazo quedan recursos corrientes para operar."
        : "El capital de trabajo es negativo: las obligaciones de corto plazo superan los recursos corrientes.") +
      trend(ct, ctPrev, true),
  });

  // ---------------- Endeudamiento ----------------
  const ne = div(bs.pasivo_total, bs.activo_total);
  const nePrev = div(bsPrev.pasivo_total, bsPrev.activo_total);
  out.push({
    key: "nivel_endeudamiento",
    group: "Endeudamiento",
    name: "Nivel de endeudamiento",
    formula: "Pasivo total / Activo total",
    unit: "porcentaje",
    current: ne,
    previous: nePrev,
    tone: ne === null ? "neutro" : ne <= 0.6 ? "bueno" : ne <= 0.7 ? "alerta" : "riesgo",
    interpretation:
      (ne === null
        ? "Sin activos registrados."
        : `El ${pct(ne)} de los activos está financiado por terceros (acreedores); el ${pct(1 - ne)} restante pertenece a los socios.` +
          (ne > 0.7 ? " Es un nivel alto que limita el acceso a nuevo crédito." : "")) +
      trend(ne, nePrev, false),
  });

  const conc = div(bs.pasivo_corriente, bs.pasivo_total);
  out.push({
    key: "concentracion_cp",
    group: "Endeudamiento",
    name: "Concentración del endeudamiento a corto plazo",
    formula: "Pasivo corriente / Pasivo total",
    unit: "porcentaje",
    current: conc,
    previous: div(bsPrev.pasivo_corriente, bsPrev.pasivo_total),
    tone: conc === null ? "neutro" : conc <= 0.7 ? "bueno" : "alerta",
    interpretation:
      conc === null
        ? "La empresa no tiene pasivos."
        : `El ${pct(conc)} de las deudas vence en menos de un año.` +
          (conc > 0.7 ? " Conviene evaluar reestructurar parte de la deuda a largo plazo." : ""),
  });

  const lev = div(bs.pasivo_total, bs.patrimonio);
  out.push({
    key: "apalancamiento",
    group: "Endeudamiento",
    name: "Apalancamiento total (leverage)",
    formula: "Pasivo total / Patrimonio",
    unit: "veces",
    current: lev,
    previous: div(bsPrev.pasivo_total, bsPrev.patrimonio),
    tone: lev === null || bs.patrimonio <= 0 ? "riesgo" : lev <= 1.5 ? "bueno" : lev <= 2.5 ? "alerta" : "riesgo",
    interpretation:
      bs.patrimonio <= 0
        ? "El patrimonio es negativo o nulo: la empresa podría estar en causal de disolución (art. 457 C. Co. / Ley 1258 de 2008) y debe evaluarse la hipótesis de negocio en marcha."
        : `Por cada peso de patrimonio, la empresa tiene $${x(lev)} de deuda con terceros.`,
  });

  const cob = div(income.utilidad_operacional, income.costos_financieros);
  out.push({
    key: "cobertura_intereses",
    group: "Endeudamiento",
    name: "Cobertura de intereses",
    formula: "Utilidad operacional / Gastos financieros",
    unit: "veces",
    current: cob,
    previous: incomePrev ? div(incomePrev.utilidad_operacional, incomePrev.costos_financieros) : null,
    tone: cob === null ? "bueno" : cob >= 3 ? "bueno" : cob >= 1 ? "alerta" : "riesgo",
    interpretation:
      cob === null
        ? "La empresa no registra gastos financieros en el periodo."
        : cob >= 1
          ? `La utilidad operacional cubre ${x(cob)} veces los gastos financieros.`
          : "La utilidad operacional no alcanza a cubrir los gastos financieros: la carga financiera está absorbiendo la operación.",
  });

  // ---------------- Rentabilidad ----------------
  const margin = (key: string, name: string, numerator: (i: IncomeStatement) => number, formula: string, good: number, noun: string) => {
    const cur = div(numerator(income), income.ingresos);
    const prev = incomePrev ? div(numerator(incomePrev), incomePrev.ingresos) : null;
    out.push({
      key,
      group: "Rentabilidad",
      name,
      formula,
      unit: "porcentaje",
      current: cur,
      previous: prev,
      tone: cur === null ? "neutro" : cur >= good ? "bueno" : cur >= 0 ? "alerta" : "riesgo",
      interpretation:
        (cur === null
          ? "No hay ingresos operacionales en el periodo."
          : cur >= 0
            ? `Por cada $100 vendidos, quedan $${(cur * 100).toFixed(1)} de ${noun}.`
            : `Por cada $100 vendidos se pierden $${Math.abs(cur * 100).toFixed(1)}.`) + trend(cur, prev, true),
    });
  };
  margin("margen_bruto", "Margen bruto", (i) => i.utilidad_bruta, "Ganancia bruta / Ingresos ordinarios", 0.3, "utilidad bruta");
  margin("margen_operacional", "Margen operacional", (i) => i.utilidad_operacional, "Utilidad operacional / Ingresos ordinarios", 0.1, "utilidad operacional");
  margin("margen_neto", "Margen neto", (i) => i.utilidad_neta, "Utilidad neta / Ingresos ordinarios", 0.05, "utilidad neta");

  const ebitda = income.utilidad_operacional + income.depreciacion;
  out.push({
    key: "ebitda",
    group: "Rentabilidad",
    name: "EBITDA",
    formula: "Utilidad operacional + Depreciaciones, amortizaciones y deterioro",
    unit: "pesos",
    current: ebitda,
    previous: incomePrev ? incomePrev.utilidad_operacional + incomePrev.depreciacion : null,
    tone: ebitda > 0 ? "bueno" : "riesgo",
    interpretation:
      ebitda > 0
        ? `La operación genera caja antes de intereses, impuestos y partidas no monetarias${income.ingresos ? ` (margen EBITDA ${pct(div(ebitda, income.ingresos))})` : ""}.`
        : "La operación no genera caja suficiente aun sin considerar intereses, impuestos y depreciaciones.",
  });

  const roa = div(income.utilidad_neta, bs.activo_total);
  out.push({
    key: "roa",
    group: "Rentabilidad",
    name: "Rentabilidad del activo (ROA)",
    formula: "Utilidad neta / Activo total",
    unit: "porcentaje",
    current: roa,
    previous: incomePrev ? div(incomePrev.utilidad_neta, bsPrev.activo_total) : null,
    tone: roa === null ? "neutro" : roa >= 0.05 ? "bueno" : roa >= 0 ? "alerta" : "riesgo",
    interpretation: roa === null ? "Sin activos." : `Cada $100 invertidos en activos generaron $${(roa * 100).toFixed(1)} de utilidad neta.`,
  });

  const roe = div(income.utilidad_neta, bs.patrimonio);
  out.push({
    key: "roe",
    group: "Rentabilidad",
    name: "Rentabilidad del patrimonio (ROE)",
    formula: "Utilidad neta / Patrimonio",
    unit: "porcentaje",
    current: bs.patrimonio > 0 ? roe : null,
    previous: incomePrev && bsPrev.patrimonio > 0 ? div(incomePrev.utilidad_neta, bsPrev.patrimonio) : null,
    tone: roe === null || bs.patrimonio <= 0 ? "riesgo" : roe >= 0.1 ? "bueno" : roe >= 0 ? "alerta" : "riesgo",
    interpretation:
      bs.patrimonio <= 0
        ? "No se calcula porque el patrimonio es negativo o nulo."
        : `Los socios obtuvieron un rendimiento del ${pct(roe)} sobre su inversión. Compárelo con la tasa de oportunidad (por ejemplo, un CDT).`,
  });

  // ---------------- Actividad ----------------
  const cartera = sumByPrefix(lines, "1305", "saldo_final") || (bs.rubros.deudores ?? 0);
  const diasCartera = income.ingresos ? (cartera / income.ingresos) * 365 : null;
  out.push({
    key: "rotacion_cartera",
    group: "Actividad",
    name: "Período de cobro de cartera",
    formula: "Clientes / Ingresos ordinarios × 365",
    unit: "dias",
    current: diasCartera,
    previous: null,
    tone: diasCartera === null ? "neutro" : diasCartera <= 60 ? "bueno" : diasCartera <= 90 ? "alerta" : "riesgo",
    interpretation:
      diasCartera === null
        ? "Sin ingresos en el periodo."
        : `En promedio, los clientes pagan en ${Math.round(diasCartera)} días.` +
          (diasCartera > 90 ? " Es un plazo largo: revise la política de crédito y el deterioro de cartera (Sección 11)." : ""),
  });

  const diasInv = income.costo_ventas ? (inv / income.costo_ventas) * 365 : null;
  out.push({
    key: "rotacion_inventario",
    group: "Actividad",
    name: "Período de rotación de inventarios",
    formula: "Inventarios / Costo de ventas × 365",
    unit: "dias",
    current: diasInv,
    previous: null,
    tone: diasInv === null ? "neutro" : diasInv <= 90 ? "bueno" : diasInv <= 180 ? "alerta" : "riesgo",
    interpretation:
      diasInv === null
        ? "No hay costo de ventas (empresa de servicios o sin inventario)."
        : `El inventario tarda en promedio ${Math.round(diasInv)} días en venderse.` +
          (diasInv > 180 ? " Podría haber inventario obsoleto: evalúe el deterioro (Sección 13)." : ""),
  });

  const proveedores = -sumByPrefix(lines, "22", "saldo_final");
  const diasProv = income.costo_ventas ? (proveedores / income.costo_ventas) * 365 : null;
  out.push({
    key: "rotacion_proveedores",
    group: "Actividad",
    name: "Período de pago a proveedores",
    formula: "Proveedores / Costo de ventas × 365",
    unit: "dias",
    current: diasProv,
    previous: null,
    tone: "neutro",
    interpretation:
      diasProv === null ? "No hay costo de ventas para medir el plazo con proveedores." : `La empresa paga a sus proveedores en promedio a ${Math.round(diasProv)} días.`,
  });

  if (diasCartera !== null && diasInv !== null && diasProv !== null) {
    const ciclo = diasCartera + diasInv - diasProv;
    out.push({
      key: "ciclo_efectivo",
      group: "Actividad",
      name: "Ciclo de conversión del efectivo",
      formula: "Días cartera + Días inventario - Días proveedores",
      unit: "dias",
      current: ciclo,
      previous: null,
      tone: ciclo <= 60 ? "bueno" : ciclo <= 120 ? "alerta" : "riesgo",
      interpretation: `Desde que paga a proveedores hasta que cobra a clientes pasan ${Math.round(ciclo)} días que la empresa debe financiar con capital de trabajo.`,
    });
  }

  // ---------------- RUP (Decreto 1082 de 2015) ----------------
  out.push(
    {
      key: "rup_liquidez",
      group: "Requisitos habilitantes (RUP)",
      name: "Índice de liquidez",
      formula: "Activo corriente / Pasivo corriente",
      unit: "veces",
      current: rc,
      previous: rcPrev,
      tone: rc === null || rc >= 1.2 ? "bueno" : "alerta",
      interpretation: "Capacidad financiera para contratación estatal. Compárelo con el mínimo exigido en el pliego (es común exigir 1,2 o más).",
    },
    {
      key: "rup_endeudamiento",
      group: "Requisitos habilitantes (RUP)",
      name: "Índice de endeudamiento",
      formula: "Pasivo total / Activo total",
      unit: "porcentaje",
      current: ne,
      previous: nePrev,
      tone: ne === null || ne <= 0.7 ? "bueno" : "alerta",
      interpretation: "Los pliegos suelen fijar un máximo (por ejemplo 70 %). Un índice menor favorece la habilitación.",
    },
    {
      key: "rup_cobertura",
      group: "Requisitos habilitantes (RUP)",
      name: "Razón de cobertura de intereses",
      formula: "Utilidad operacional / Gastos de intereses",
      unit: "veces",
      current: cob,
      previous: null,
      tone: cob === null || cob >= 1 ? "bueno" : "riesgo",
      interpretation: "Si no hay gastos de intereses el indicador es indeterminado y la entidad suele darlo por cumplido.",
    },
    {
      key: "rup_roe",
      group: "Requisitos habilitantes (RUP)",
      name: "Rentabilidad del patrimonio",
      formula: "Utilidad operacional / Patrimonio",
      unit: "porcentaje",
      current: div(income.utilidad_operacional, bs.patrimonio),
      previous: null,
      tone: income.utilidad_operacional >= 0 ? "bueno" : "riesgo",
      interpretation: "Capacidad organizacional exigida en procesos de contratación estatal.",
    },
    {
      key: "rup_roa",
      group: "Requisitos habilitantes (RUP)",
      name: "Rentabilidad del activo",
      formula: "Utilidad operacional / Activo total",
      unit: "porcentaje",
      current: div(income.utilidad_operacional, bs.activo_total),
      previous: null,
      tone: income.utilidad_operacional >= 0 ? "bueno" : "riesgo",
      interpretation: "Capacidad organizacional exigida en procesos de contratación estatal.",
    }
  );

  return out;
}
