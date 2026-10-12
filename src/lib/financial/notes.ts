import { RUBROS, RUBRO_BY_KEY } from "./puc-mapping";
import type { TBLine } from "./statements";

/**
 * Notas a los estados financieros generadas a partir de la empresa y el
 * balance de prueba. Cada texto es un borrador profesional que el contador
 * puede editar; la edición se guarda en financial_notes y reemplaza el texto
 * por defecto de esa nota.
 */

export type Framework = "grupo1" | "grupo2" | "grupo3";

export const FRAMEWORK_LABEL: Record<Framework, string> = {
  grupo1: "Grupo 1 - NIIF plenas (Anexo 1 del Decreto 2420 de 2015)",
  grupo2: "Grupo 2 - NIIF para las PYMES (Anexo 2 del Decreto 2420 de 2015)",
  grupo3: "Grupo 3 - Microempresas (Anexo 3 del Decreto 2420 de 2015)",
};

export interface NoteContext {
  razonSocial: string;
  nit: string;
  municipio: string | null;
  departamento: string | null;
  tipoContribuyente: string;
  periodStart: string;
  periodEnd: string;
  framework: Framework;
}

export interface NoteDetailRow {
  code: string;
  name: string;
  current: number;
  previous: number;
}

export interface Note {
  key: string;
  number: number;
  title: string;
  text: string;
  edited: boolean;
  detail?: NoteDetailRow[];
}

const fecha = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });

function standardRef(framework: Framework, pymes: string, plenas: string): string {
  if (framework === "grupo1") return plenas;
  if (framework === "grupo3") return "el marco técnico normativo para microempresas";
  return pymes;
}

const POLICY_TEXT: Record<string, (f: Framework) => string> = {
  efectivo: () =>
    "Incluye el efectivo en caja, los depósitos a la vista en bancos y las inversiones de alta liquidez con vencimiento original igual o inferior a tres meses, fácilmente convertibles en efectivo y sujetas a un riesgo poco significativo de cambios en su valor.",
  deudores: (f) =>
    `Las cuentas por cobrar se reconocen inicialmente al precio de la transacción y posteriormente al costo amortizado, de acuerdo con ${standardRef(f, "la Sección 11 de la NIIF para las PYMES", "la NIIF 9")}. Al cierre de cada periodo se evalúa si existe evidencia objetiva de deterioro y, de existir, se reconoce una pérdida en resultados.`,
  inventarios: (f) =>
    `Los inventarios se miden al menor entre el costo y el precio de venta estimado menos los costos de terminación y venta (${standardRef(f, "Sección 13", "NIC 2")}). El costo se determina por el método del promedio ponderado.`,
  ppe: (f) =>
    `Las propiedades, planta y equipo se miden al costo menos la depreciación acumulada y las pérdidas por deterioro (${standardRef(f, "Sección 17", "NIC 16")}). La depreciación se calcula por el método de línea recta durante la vida útil estimada de cada activo; las vidas útiles, valores residuales y métodos se revisan cuando hay indicios de cambios significativos.`,
  intangibles: (f) =>
    `Los activos intangibles se miden al costo menos la amortización acumulada y el deterioro (${standardRef(f, "Sección 18", "NIC 38")}). Se amortizan por línea recta durante su vida útil; cuando esta no puede estimarse con fiabilidad se presume de diez años.`,
  obligaciones_financieras: (f) =>
    `Los préstamos se reconocen inicialmente al precio de la transacción, incluidos los costos de transacción, y posteriormente al costo amortizado usando el método del interés efectivo (${standardRef(f, "Sección 11", "NIIF 9")}).`,
  proveedores_cxp: () =>
    "Las cuentas por pagar comerciales son obligaciones basadas en condiciones de crédito normales que no generan intereses y se miden al importe no descontado.",
  beneficios_empleados: (f) =>
    `Los beneficios a corto plazo (salarios, prestaciones sociales, vacaciones y aportes) se reconocen como gasto y pasivo cuando el empleado presta el servicio (${standardRef(f, "Sección 28", "NIC 19")}).`,
  provisiones: (f) =>
    `Se reconoce una provisión cuando existe una obligación presente resultado de un suceso pasado, es probable que se requiera una salida de recursos y el importe puede estimarse con fiabilidad (${standardRef(f, "Sección 21", "NIC 37")}).`,
  impuestos_pasivo: (f) =>
    `El gasto por impuesto a las ganancias comprende el impuesto corriente y el diferido (${standardRef(f, "Sección 29", "NIC 12")}). El impuesto corriente se calcula con base en la renta líquida gravable a la tarifa vigente del Estatuto Tributario.`,
  ingresos_ordinarios: (f) =>
    `Los ingresos de actividades ordinarias se miden al valor razonable de la contraprestación recibida o por recibir, neto de descuentos y devoluciones, y se reconocen cuando se transfieren los riesgos y ventajas o se presta el servicio (${standardRef(f, "Sección 23", "NIIF 15")}).`,
};

export function buildNotes(
  ctx: NoteContext,
  lines: TBLine[],
  overrides: Record<string, string>
): Note[] {
  const notes: Note[] = [];
  const push = (key: string, title: string, text: string, detail?: NoteDetailRow[]) => {
    const override = overrides[key];
    notes.push({
      key,
      number: notes.length + 1,
      title,
      text: override ?? text,
      edited: override !== undefined,
      detail,
    });
  };

  const ubicacion = [ctx.municipio, ctx.departamento].filter(Boolean).join(", ") || "Colombia";

  push(
    "entidad",
    "Entidad que reporta",
    `${ctx.razonSocial}, identificada con NIT ${ctx.nit}, es una ${ctx.tipoContribuyente.replace(/_/g, " ")} con domicilio en ${ubicacion}. Su objeto social principal es [describir la actividad económica principal según el certificado de existencia y representación legal / RUT]. El término de duración es [indefinido / hasta ...].`
  );

  push(
    "bases",
    "Bases de preparación",
    `Los estados financieros han sido preparados de conformidad con las Normas de Contabilidad y de Información Financiera aceptadas en Colombia, establecidas en la Ley 1314 de 2009 y reglamentadas por el Decreto Único Reglamentario 2420 de 2015 y sus modificatorios, que corresponden al ${FRAMEWORK_LABEL[ctx.framework]}.

Comprenden el estado de situación financiera al ${fecha(ctx.periodEnd)}, el estado de resultados integral, el estado de cambios en el patrimonio y el estado de flujos de efectivo por el periodo comprendido entre el ${fecha(ctx.periodStart)} y el ${fecha(ctx.periodEnd)}, y sus notas.

Moneda funcional y de presentación: peso colombiano (COP). Las cifras se presentan en pesos colombianos.

Base de medición: costo histórico, excepto donde se indique lo contrario en las políticas contables.

Negocio en marcha: la administración considera que la entidad tiene la capacidad de continuar en funcionamiento en el futuro previsible y no tiene la intención ni la necesidad de liquidarse.

Base de acumulación (devengo): los hechos económicos se reconocen cuando ocurren, con independencia del momento en que se recibe o paga el efectivo.

Materialidad: un hecho económico es material cuando, debido a su naturaleza o cuantía, su omisión o expresión inadecuada puede alterar las decisiones de los usuarios de la información.`
  );

  // Políticas contables solo para los rubros que tienen saldo
  const withBalance = new Set(
    lines.filter((l) => Number(l.saldo_final) !== 0 || Number(l.saldo_anterior) !== 0).map((l) => l.rubro)
  );
  const policies = Object.entries(POLICY_TEXT)
    .filter(([key]) => withBalance.has(key) || (key === "impuestos_pasivo" && withBalance.has("impuesto_renta")))
    .map(([key, text]) => `${RUBRO_BY_KEY.get(key)?.label}: ${text(ctx.framework)}`)
    .join("\n\n");
  push("politicas", "Resumen de las políticas contables significativas", policies || "Describa aquí las políticas contables aplicadas.");

  // Una nota por rubro con saldo, con el detalle de sus cuentas
  for (const r of RUBROS) {
    if (r.section === "excluido" || r.key === "resultado_ejercicio") continue;
    const rubroLines = lines.filter((l) => l.rubro === r.key);
    const sign = r.nature === "credit" ? -1 : 1;
    const isResult = r.section === "resultados";
    const detail = rubroLines
      .map((l) => ({
        code: l.account_code,
        name: l.account_name,
        // Resultados: movimiento del periodo. Balance: saldo final vs. anterior.
        current: sign * (isResult ? Number(l.saldo_final) - Number(l.saldo_anterior) : Number(l.saldo_final)),
        previous: isResult ? 0 : sign * Number(l.saldo_anterior),
      }))
      .filter((d) => Math.round(d.current) !== 0 || Math.round(d.previous) !== 0)
      .sort((a, b) => a.code.localeCompare(b.code));

    if (detail.length === 0) continue;

    const total = detail.reduce((s, d) => s + d.current, 0);
    const prevTotal = detail.reduce((s, d) => s + d.previous, 0);
    const variation = prevTotal ? ((total - prevTotal) / Math.abs(prevTotal)) * 100 : null;

    const text = isResult
      ? `Durante el periodo, ${r.label.toLowerCase()} ascendieron a $${Math.round(total).toLocaleString("es-CO")}. [Explique las causas principales y su relación con la actividad de la entidad.]`
      : `Al ${fecha(ctx.periodEnd)} el saldo de ${r.label.toLowerCase()} es de $${Math.round(total).toLocaleString("es-CO")}` +
        (variation !== null
          ? `, con una variación del ${variation.toFixed(1)} % frente al periodo anterior ($${Math.round(prevTotal).toLocaleString("es-CO")}). [Explique las causas de la variación.]`
          : ". [Describa la composición, restricciones o garantías, si las hay.]");

    push(`rubro_${r.key}`, r.label, text, detail);
  }

  push(
    "hechos_posteriores",
    "Hechos ocurridos después del periodo sobre el que se informa",
    "Entre la fecha de cierre y la fecha de autorización de los estados financieros no se presentaron hechos que requieran ajustes o revelaciones adicionales. [Modifique si existen hechos relevantes.]"
  );

  push(
    "aprobacion",
    "Aprobación de los estados financieros",
    "Los estados financieros y sus notas fueron autorizados para su publicación por el representante legal el [fecha] y serán presentados a la asamblea general de accionistas / junta de socios para su aprobación, de acuerdo con el artículo 34 de la Ley 222 de 1995."
  );

  return notes;
}
