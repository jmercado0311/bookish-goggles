import { RUBROS, RUBRO_BY_KEY } from "./puc-mapping";
import { FRAMEWORKS, type Framework } from "./frameworks";
import type { TBLine } from "./statements";

/**
 * Notas a los estados financieros generadas a partir de la empresa, su
 * grupo NIIF y el balance de prueba. El contenido cambia según el marco
 * técnico (referencias normativas, juego de estados, notas exigidas).
 * Cada texto es un borrador profesional que el contador puede editar; la
 * edición se guarda en financial_notes y reemplaza el texto por defecto.
 */

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

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

/** Políticas contables por rubro y por marco técnico. */
const POLICIES: Record<string, Record<Framework, string>> = {
  efectivo: {
    grupo1:
      "Incluye el efectivo en caja, los depósitos a la vista y las inversiones a corto plazo de gran liquidez, fácilmente convertibles en importes determinados de efectivo y sujetas a un riesgo insignificante de cambios en su valor, con vencimiento original igual o inferior a tres meses (NIC 7, párrafos 6 y 7).",
    grupo2:
      "Incluye el efectivo en caja, los depósitos a la vista y las inversiones a corto plazo de gran liquidez, con vencimiento original igual o inferior a tres meses (NIIF para las PYMES, párrafo 7.2).",
    grupo3: "Comprende el dinero en caja y en cuentas bancarias, medido por su valor nominal.",
  },
  deudores: {
    grupo1:
      "Las cuentas por cobrar comerciales se reconocen al precio de la transacción y se miden al costo amortizado por el método del interés efectivo. Las pérdidas por deterioro se reconocen con el modelo de pérdidas crediticias esperadas (NIIF 9, Sección 5.5), usando el enfoque simplificado para cuentas comerciales.",
    grupo2:
      "Las cuentas por cobrar son instrumentos financieros básicos que se reconocen al precio de la transacción y se miden al costo amortizado. Al final de cada periodo se evalúa si existe evidencia objetiva de deterioro y, de existir, se reconoce una pérdida en resultados (NIIF para las PYMES, Sección 11, párrafos 11.21 a 11.26).",
    grupo3:
      "Las cuentas por cobrar se miden por su valor nominal. Cuando existe evidencia de que no se podrán recuperar, se reconoce el deterioro correspondiente en resultados.",
  },
  inventarios: {
    grupo1:
      "Los inventarios se miden al menor entre el costo y el valor neto realizable. El costo se determina por el método del promedio ponderado (NIC 2, párrafos 9 y 25).",
    grupo2:
      "Los inventarios se miden al importe menor entre el costo y el precio de venta estimado menos los costos de terminación y venta. El costo se determina por el método del promedio ponderado (NIIF para las PYMES, párrafos 13.4 y 13.18).",
    grupo3:
      "Los inventarios se miden al costo, determinado por el método del promedio ponderado; cuando su valor de venta es inferior al costo se reconoce la pérdida en resultados.",
  },
  ppe: {
    grupo1:
      "Las propiedades, planta y equipo se miden al costo menos la depreciación acumulada y las pérdidas por deterioro (modelo del costo, NIC 16 párrafo 30). La depreciación es lineal durante la vida útil; las vidas útiles, valores residuales y métodos se revisan al menos al cierre de cada periodo (NIC 16, párrafo 51). El deterioro se evalúa según la NIC 36.",
    grupo2:
      "Las propiedades, planta y equipo se miden al costo menos la depreciación acumulada y las pérdidas por deterioro (NIIF para las PYMES, párrafo 17.15). La depreciación es lineal durante la vida útil y se revisa cuando hay indicios de cambios significativos (párrafo 17.19).",
    grupo3:
      "Las propiedades, planta y equipo se registran al costo de adquisición y se deprecian por el método de línea recta durante su vida útil estimada.",
  },
  intangibles: {
    grupo1:
      "Los activos intangibles se miden al costo menos la amortización acumulada y el deterioro. Los de vida útil finita se amortizan linealmente; los de vida útil indefinida no se amortizan y se someten a prueba de deterioro anual (NIC 38, párrafos 74, 97 y 107).",
    grupo2:
      "Los activos intangibles se miden al costo menos la amortización acumulada y el deterioro, y se consideran de vida útil finita. Si la vida útil no puede estimarse con fiabilidad, se determina con base en la mejor estimación de la gerencia sin exceder de diez años (NIIF para las PYMES, párrafos 18.18 a 18.20).",
    grupo3: "Los intangibles adquiridos se registran al costo y se amortizan durante el periodo en que se espera obtener sus beneficios.",
  },
  obligaciones_financieras: {
    grupo1:
      "Los pasivos financieros por préstamos se reconocen inicialmente al valor razonable menos los costos de transacción y posteriormente al costo amortizado por el método del interés efectivo (NIIF 9, párrafos 4.2.1 y 5.1.1).",
    grupo2:
      "Los préstamos se reconocen inicialmente al precio de la transacción, incluidos los costos de transacción, y posteriormente al costo amortizado por el método del interés efectivo (NIIF para las PYMES, párrafos 11.13 y 11.14).",
    grupo3: "Las obligaciones financieras se registran por el valor recibido y los intereses se reconocen como gasto en el periodo en que se causan.",
  },
  proveedores_cxp: {
    grupo1:
      "Las cuentas por pagar comerciales se miden al costo amortizado; las de corto plazo sin intereses se miden por su importe nominal cuando el efecto del descuento no es material.",
    grupo2:
      "Las cuentas por pagar comerciales son obligaciones con condiciones de crédito normales que no generan intereses y se miden al importe no descontado (NIIF para las PYMES, párrafo 11.13).",
    grupo3: "Las cuentas por pagar se registran por su valor nominal.",
  },
  beneficios_empleados: {
    grupo1:
      "Los beneficios a corto plazo (salarios, prestaciones sociales, vacaciones y aportes) se reconocen como gasto y pasivo por el importe no descontado cuando el empleado presta el servicio (NIC 19, párrafo 11).",
    grupo2:
      "Los beneficios a corto plazo se reconocen como gasto y pasivo cuando el empleado presta el servicio, por el importe no descontado (NIIF para las PYMES, párrafo 28.5).",
    grupo3: "Las obligaciones laborales se reconocen mensualmente de acuerdo con la legislación laboral vigente.",
  },
  provisiones: {
    grupo1:
      "Se reconoce una provisión cuando existe una obligación presente (legal o implícita) resultado de un suceso pasado, es probable una salida de recursos y el importe puede estimarse con fiabilidad; se mide por la mejor estimación del desembolso (NIC 37, párrafos 14 y 36).",
    grupo2:
      "Se reconoce una provisión cuando existe una obligación presente resultado de un suceso pasado, es probable una salida de recursos y el importe puede estimarse con fiabilidad (NIIF para las PYMES, párrafo 21.4).",
    grupo3: "Se reconocen provisiones por obligaciones presentes cuyo pago es probable y cuyo valor puede estimarse.",
  },
  impuestos_pasivo: {
    grupo1:
      "El gasto por impuesto a las ganancias comprende el impuesto corriente y el diferido (NIC 12). El impuesto corriente se calcula sobre la renta líquida gravable a la tarifa del Estatuto Tributario. El impuesto diferido se reconoce por las diferencias temporarias entre la base contable y la fiscal de activos y pasivos.",
    grupo2:
      "El gasto por impuesto a las ganancias comprende el impuesto corriente y el diferido (NIIF para las PYMES, Sección 29). El impuesto corriente se calcula sobre la renta líquida gravable a la tarifa del Estatuto Tributario; el diferido se reconoce por las diferencias temporarias.",
    grupo3:
      "El impuesto de renta corriente se reconoce como gasto con base en la renta líquida gravable del periodo. El marco técnico para microempresas no contempla impuesto diferido.",
  },
  ingresos_ordinarios: {
    grupo1:
      "Los ingresos de actividades ordinarias se reconocen cuando (o a medida que) la entidad satisface una obligación de desempeño mediante la transferencia del control de los bienes o servicios comprometidos con el cliente, por el importe de la contraprestación a la que espera tener derecho (NIIF 15, párrafos 31 y 47).",
    grupo2:
      "Los ingresos de actividades ordinarias se miden al valor razonable de la contraprestación recibida o por recibir, neto de descuentos y devoluciones, y se reconocen cuando se transfieren los riesgos y ventajas significativos o se presta el servicio (NIIF para las PYMES, párrafos 23.3, 23.10 y 23.14).",
    grupo3:
      "Los ingresos se reconocen cuando se venden los bienes o se prestan los servicios, por el valor facturado neto de descuentos y devoluciones.",
  },
};

function listaEstados(f: Framework): string {
  const s = FRAMEWORKS[f].statements;
  const list = [s.situacion, s.resultados, s.patrimonio, s.flujos].filter(Boolean) as string[];
  return list.map((t) => t.toLowerCase()).join(", ");
}

export function buildNotes(
  ctx: NoteContext,
  lines: TBLine[],
  overrides: Record<string, string>
): Note[] {
  const spec = FRAMEWORKS[ctx.framework];
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

  const bases = [
    `Los estados financieros han sido preparados de conformidad con las Normas de Contabilidad y de Información Financiera aceptadas en Colombia, establecidas en la Ley 1314 de 2009 y reglamentadas por el Decreto Único Reglamentario 2420 de 2015 y sus modificatorios. La entidad pertenece al ${spec.label}.`,
    spec.declaracionCumplimiento,
    `El juego completo de estados financieros (${spec.juegoCompletoRef}) comprende: ${listaEstados(ctx.framework)} por el periodo comprendido entre el ${fecha(ctx.periodStart)} y el ${fecha(ctx.periodEnd)}, y las notas que incluyen un resumen de las políticas contables significativas.`,
    spec.comparativo.exigido
      ? `Información comparativa: la entidad presenta información comparativa respecto del periodo anterior para todos los importes de los estados financieros (${spec.comparativo.ref}).`
      : "Información comparativa: se presentan las cifras del periodo anterior cuando están disponibles.",
    "Moneda funcional y de presentación: peso colombiano (COP). Las cifras se presentan en pesos colombianos.",
    ctx.framework === "grupo3"
      ? "Base de medición: costo histórico."
      : "Base de medición: costo histórico, excepto donde se indique lo contrario en las políticas contables.",
    "Negocio en marcha: la administración considera que la entidad tiene la capacidad de continuar en funcionamiento en el futuro previsible y no tiene la intención ni la necesidad de liquidarse.",
    "Base de acumulación (devengo): los hechos económicos se reconocen cuando ocurren, con independencia del momento en que se recibe o paga el efectivo.",
    "Materialidad: un hecho económico es material cuando, debido a su naturaleza o cuantía, su omisión o expresión inadecuada puede alterar las decisiones de los usuarios de la información.",
  ]
    .filter(Boolean)
    .join("\n\n");
  push("bases", "Bases de preparación", bases);

  // Políticas contables solo para los rubros que tienen saldo
  const withBalance = new Set(
    lines.filter((l) => Number(l.saldo_final) !== 0 || Number(l.saldo_anterior) !== 0).map((l) => l.rubro)
  );
  const policies = Object.entries(POLICIES)
    .filter(([key]) => withBalance.has(key) || (key === "impuestos_pasivo" && withBalance.has("impuesto_renta")))
    .map(([key, text]) => `${RUBRO_BY_KEY.get(key)?.label}: ${text[ctx.framework]}`)
    .join("\n\n");
  push("politicas", "Resumen de las políticas contables significativas", policies || "Describa aquí las políticas contables aplicadas.");

  if (ctx.framework !== "grupo3") {
    push(
      "juicios",
      "Juicios y estimaciones contables significativos",
      `${ctx.framework === "grupo1" ? "NIC 1, párrafos 122 y 125" : "NIIF para las PYMES, párrafos 8.6 y 8.7"}: en la aplicación de las políticas contables la administración realizó juicios y estimaciones sobre [vidas útiles de propiedades, planta y equipo, deterioro de cuentas por cobrar e inventarios, provisiones y el impuesto diferido]. Las estimaciones se revisan periódicamente y sus efectos se reconocen en el periodo de la revisión.`
    );
  }

  // Una nota por rubro con saldo, con el detalle de sus cuentas
  for (const r of RUBROS) {
    if (r.section === "excluido" || r.key === "resultado_ejercicio") continue;
    if (!spec.ori && r.key === "ori") continue;
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
      ? `Durante el periodo, ${r.label.toLowerCase()} ascendieron a ${pesos(total)}. [Explique las causas principales y su relación con la actividad de la entidad.]`
      : `Al ${fecha(ctx.periodEnd)} el saldo de ${r.label.toLowerCase()} es de ${pesos(total)}` +
        (variation !== null
          ? `, con una variación del ${variation.toFixed(1)} % frente al periodo anterior (${pesos(prevTotal)}). [Explique las causas de la variación.]`
          : ". [Describa la composición, restricciones o garantías, si las hay.]");

    push(`rubro_${r.key}`, r.label, text, detail);
  }

  // NIC 1.104: con gastos clasificados por función, revelar su naturaleza
  if (spec.gastosPorNaturaleza) {
    const mov = (prefixes: string[]) =>
      lines
        .filter((l) => prefixes.some((p) => l.account_code.startsWith(p)))
        .reduce((s, l) => s + Number(l.saldo_final) - Number(l.saldo_anterior), 0);
    const personal = mov(["5105", "5205"]);
    const depreciacion = mov(["5160", "5165", "5260", "5265"]);
    push(
      "gastos_naturaleza",
      "Información sobre la naturaleza de los gastos",
      `Los gastos se presentan clasificados por su función. De acuerdo con la NIC 1, párrafo 104, se revela que el periodo incluye gastos por beneficios a los empleados de ${pesos(personal)} y gastos por depreciación y amortización de ${pesos(depreciacion)}, incluidos en los gastos de administración y de ventas.`
    );
    push(
      "capital",
      "Gestión del capital",
      "De acuerdo con la NIC 1, párrafos 134 y 135, la entidad gestiona su capital para asegurar la continuidad del negocio y maximizar el rendimiento para los accionistas. [Describa los objetivos, políticas y procesos de gestión del capital y si la entidad está sujeta a requerimientos externos de capital.]"
    );
  }

  push(
    "hechos_posteriores",
    "Hechos ocurridos después del periodo sobre el que se informa",
    `Entre la fecha de cierre y la fecha de autorización de los estados financieros no se presentaron hechos que requieran ajustes o revelaciones adicionales${ctx.framework === "grupo1" ? " (NIC 10)" : ctx.framework === "grupo2" ? " (NIIF para las PYMES, Sección 32)" : ""}. [Modifique si existen hechos relevantes.]`
  );

  push(
    "aprobacion",
    "Aprobación de los estados financieros",
    "Los estados financieros y sus notas fueron autorizados para su publicación por el representante legal el [fecha] y serán presentados a la asamblea general de accionistas / junta de socios para su aprobación, de acuerdo con el artículo 34 de la Ley 222 de 1995."
  );

  return notes;
}
