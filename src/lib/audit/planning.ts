import { RUBRO_BY_KEY } from "@/lib/financial/puc-mapping";
import type { BalanceSheet, IncomeStatement, TBLine } from "@/lib/financial/statements";

/**
 * Planeación del encargo de revisoría fiscal: materialidad (NIA 320),
 * identificación de riesgos (NIA 315 / 240 / 570) y papeles de trabajo con
 * los procedimientos de respuesta (NIA 330 / 500 / 501 / 505 / 520 / 540 /
 * 550 / 560). Todo es un borrador que el revisor fiscal ajusta con su juicio
 * profesional.
 */

export type MaterialityBase = "activos" | "ingresos" | "utilidad" | "patrimonio";

export const MATERIALITY_BASES: Record<MaterialityBase, { label: string; rango: string; porcentaje: number }> = {
  activos: { label: "Activos totales", rango: "0,5 % a 2 %", porcentaje: 1 },
  ingresos: { label: "Ingresos ordinarios", rango: "0,5 % a 2 %", porcentaje: 1 },
  utilidad: { label: "Utilidad antes de impuestos", rango: "3 % a 10 %", porcentaje: 5 },
  patrimonio: { label: "Patrimonio", rango: "1 % a 5 %", porcentaje: 2 },
};

export function materialityBaseAmount(base: MaterialityBase, bs: BalanceSheet, income: IncomeStatement): number {
  switch (base) {
    case "activos":
      return bs.current.activo_total;
    case "ingresos":
      return income.ingresos;
    case "utilidad":
      return Math.abs(income.utilidad_antes_impuestos);
    default:
      return bs.current.patrimonio;
  }
}

export function computeMateriality(baseAmount: number, porcentaje: number) {
  const global = Math.round(Math.abs(baseAmount) * (porcentaje / 100));
  return {
    global,
    // Materialidad de ejecución: 75 % (riesgo bajo-moderado) y umbral de incorrecciones claramente insignificantes: 5 %
    ejecucion: Math.round(global * 0.75),
    trivial: Math.round(global * 0.05),
  };
}

export type Level = "alto" | "medio" | "bajo";

export interface RiskDraft {
  area: string;
  afirmacion: string;
  descripcion: string;
  riesgo_inherente: Level;
  riesgo_control: Level;
  significativo: boolean;
  respuesta: string;
}

export interface WorkpaperDraft {
  ref: string;
  area: string;
  titulo: string;
  objetivo: string;
  procedimientos: string;
}

interface AreaTemplate {
  ref: string;
  titulo: string;
  rubros: string[];
  objetivo: string;
  riesgos: Omit<RiskDraft, "area" | "significativo" | "riesgo_control">[];
  procedimientos: string[];
}

const AREAS: AreaTemplate[] = [
  {
    ref: "B",
    titulo: "Efectivo y equivalentes al efectivo",
    rubros: ["efectivo"],
    objetivo: "Verificar la existencia, integridad y adecuada presentación del efectivo y sus equivalentes.",
    riesgos: [
      { afirmacion: "Existencia", descripcion: "Saldos bancarios inexistentes o partidas conciliatorias antiguas sin depurar.", riesgo_inherente: "medio", respuesta: "Confirmación externa de saldos (NIA 505) y revisión de conciliaciones bancarias al corte." },
      { afirmacion: "Integridad", descripcion: "Cuentas bancarias o movimientos no registrados.", riesgo_inherente: "bajo", respuesta: "Cruce de extractos contra auxiliares y certificación bancaria de cuentas a nombre de la entidad." },
    ],
    procedimientos: [
      "Obtener las conciliaciones bancarias al corte y verificar su elaboración y revisión.",
      "Confirmar saldos y productos con las entidades financieras (NIA 505).",
      "Analizar partidas conciliatorias con más de 30 días y su posterior regularización.",
      "Realizar arqueo de caja general y cajas menores.",
      "Verificar restricciones o embargos sobre cuentas y su revelación.",
    ],
  },
  {
    ref: "C",
    titulo: "Deudores comerciales y otras cuentas por cobrar",
    rubros: ["deudores", "deudores_lp"],
    objetivo: "Verificar la existencia y adecuada valuación de las cuentas por cobrar, incluido su deterioro.",
    riesgos: [
      { afirmacion: "Existencia", descripcion: "Cuentas por cobrar ficticias o ya recaudadas.", riesgo_inherente: "medio", respuesta: "Confirmación de saldos con clientes y revisión de cobros posteriores al cierre." },
      { afirmacion: "Valuación", descripcion: "Deterioro de cartera no reconocido o insuficiente.", riesgo_inherente: "alto", respuesta: "Análisis de antigüedad, revisión de la estimación del deterioro (NIA 540) y de la política contable." },
    ],
    procedimientos: [
      "Obtener la cartera por edades y conciliarla con el saldo contable.",
      "Enviar confirmaciones a una muestra de clientes (NIA 505 y NIA 530).",
      "Revisar recaudos posteriores al cierre para saldos no confirmados.",
      "Evaluar la estimación del deterioro de cartera y su consistencia con la política contable (NIA 540).",
      "Identificar saldos con partes vinculadas y su revelación (NIA 550).",
    ],
  },
  {
    ref: "D",
    titulo: "Inventarios",
    rubros: ["inventarios"],
    objetivo: "Verificar la existencia física, la valuación al menor entre costo y valor neto realizable y el corte de los inventarios.",
    riesgos: [
      { afirmacion: "Existencia", descripcion: "Diferencias entre el inventario físico y el registrado.", riesgo_inherente: "alto", respuesta: "Presenciar la toma física de inventarios (NIA 501)." },
      { afirmacion: "Valuación", descripcion: "Inventario obsoleto o de lenta rotación sin ajuste a valor neto realizable.", riesgo_inherente: "medio", respuesta: "Pruebas de valor neto realizable y análisis de rotación." },
    ],
    procedimientos: [
      "Presenciar la toma física de inventarios al cierre y realizar conteos de prueba (NIA 501).",
      "Verificar el corte de compras y ventas alrededor de la fecha de cierre.",
      "Probar el costo unitario de una muestra contra facturas de compra.",
      "Comparar el costo con el precio de venta posterior para identificar ajustes a valor neto realizable.",
    ],
  },
  {
    ref: "E",
    titulo: "Propiedades, planta y equipo",
    rubros: ["ppe", "intangibles"],
    objetivo: "Verificar la existencia, la titularidad, la depreciación y el deterioro de los activos fijos e intangibles.",
    riesgos: [
      { afirmacion: "Existencia y derechos", descripcion: "Activos inexistentes o que no son de propiedad de la entidad.", riesgo_inherente: "medio", respuesta: "Inspección física de adiciones significativas y verificación de títulos de propiedad." },
      { afirmacion: "Valuación", descripcion: "Vidas útiles o depreciación inadecuadas; deterioro no reconocido.", riesgo_inherente: "medio", respuesta: "Recálculo de la depreciación y evaluación de indicios de deterioro." },
    ],
    procedimientos: [
      "Obtener el detalle de activos fijos y conciliarlo con la contabilidad.",
      "Inspeccionar físicamente una muestra de activos y verificar documentos de propiedad (escrituras, tarjetas de propiedad).",
      "Revisar adiciones y retiros del periodo con sus soportes.",
      "Recalcular la depreciación y amortización del periodo.",
      "Evaluar indicios de deterioro y la revisión de vidas útiles.",
      "Verificar pólizas de seguro vigentes sobre los activos.",
    ],
  },
  {
    ref: "G",
    titulo: "Obligaciones financieras",
    rubros: ["obligaciones_financieras", "obligaciones_financieras_lp", "otros_pasivos_lp"],
    objetivo: "Verificar la integridad de las obligaciones financieras, su clasificación corriente/no corriente y los intereses.",
    riesgos: [
      { afirmacion: "Integridad", descripcion: "Obligaciones o garantías no registradas.", riesgo_inherente: "medio", respuesta: "Confirmación con entidades financieras y revisión de actas." },
      { afirmacion: "Clasificación", descripcion: "Porción a largo plazo presentada como corriente o viceversa.", riesgo_inherente: "medio", respuesta: "Revisión de tablas de amortización." },
    ],
    procedimientos: [
      "Confirmar saldos, tasas y garantías con las entidades financieras.",
      "Revisar tablas de amortización y la clasificación corriente/no corriente.",
      "Recalcular los intereses causados del periodo.",
      "Revisar actas de junta y asamblea para identificar créditos aprobados.",
    ],
  },
  {
    ref: "H",
    titulo: "Proveedores y cuentas por pagar",
    rubros: ["proveedores_cxp", "otros_pasivos_cp", "provisiones"],
    objetivo: "Verificar la integridad de los pasivos con proveedores y otras cuentas por pagar, y de las provisiones.",
    riesgos: [
      { afirmacion: "Integridad", descripcion: "Pasivos no registrados al cierre.", riesgo_inherente: "alto", respuesta: "Búsqueda de pasivos no registrados con pagos posteriores al cierre." },
      { afirmacion: "Valuación", descripcion: "Provisiones y litigios sin reconocer o sin revelar.", riesgo_inherente: "medio", respuesta: "Carta a abogados y revisión de procesos (NIA 501)." },
    ],
    procedimientos: [
      "Conciliar el saldo de proveedores con los estados de cuenta de los principales proveedores.",
      "Revisar pagos y facturas posteriores al cierre para identificar pasivos no registrados.",
      "Solicitar carta a los abogados sobre litigios y contingencias (NIA 501).",
      "Evaluar las provisiones reconocidas y su base de estimación (NIA 540).",
    ],
  },
  {
    ref: "I",
    titulo: "Impuestos",
    rubros: ["impuestos_activo", "impuestos_pasivo", "impuesto_diferido_activo", "impuesto_diferido_pasivo", "impuesto_renta"],
    objetivo: "Verificar el cumplimiento de las obligaciones tributarias, la razonabilidad de los saldos y el impuesto a las ganancias.",
    riesgos: [
      { afirmacion: "Integridad y cumplimiento", descripcion: "Declaraciones presentadas extemporáneamente o con errores; sanciones no provisionadas.", riesgo_inherente: "alto", respuesta: "Revisión del calendario tributario, declaraciones y pagos del periodo." },
      { afirmacion: "Valuación", descripcion: "Provisión de renta o impuesto diferido mal calculados.", riesgo_inherente: "medio", respuesta: "Recálculo de la provisión de renta y de la conciliación fiscal." },
    ],
    procedimientos: [
      "Verificar la presentación y el pago oportuno de las declaraciones del periodo (renta, IVA, retención, ICA).",
      "Conciliar los saldos por pagar con las declaraciones presentadas.",
      "Recalcular la provisión de impuesto de renta y revisar la conciliación fiscal (formato 2516/2517).",
      "Evaluar la razonabilidad del impuesto diferido, si aplica.",
      "Revisar requerimientos y procesos abiertos con la DIAN y entes territoriales.",
    ],
  },
  {
    ref: "J",
    titulo: "Beneficios a los empleados y seguridad social",
    rubros: ["beneficios_empleados"],
    objetivo: "Verificar la razonabilidad de la nómina y las prestaciones, y el pago oportuno de aportes al sistema de seguridad social.",
    riesgos: [
      { afirmacion: "Integridad y cumplimiento", descripcion: "Prestaciones sociales no consolidadas o aportes a seguridad social sin pagar o pagados extemporáneamente.", riesgo_inherente: "medio", respuesta: "Verificación de la consolidación de prestaciones y de las planillas PILA (art. 11 Decreto 1406 de 1999)." },
    ],
    procedimientos: [
      "Recalcular la consolidación de cesantías, intereses, primas y vacaciones.",
      "Verificar el pago oportuno de aportes a seguridad social y parafiscales mediante las planillas PILA.",
      "Comparar la nómina contable con la nómina electrónica transmitida a la DIAN.",
      "Revisar contratos y novedades de personal de una muestra.",
    ],
  },
  {
    ref: "K",
    titulo: "Patrimonio",
    rubros: ["capital", "prima", "reservas", "otro_patrimonio", "ori", "resultados_acumulados"],
    objetivo: "Verificar que los movimientos patrimoniales estén autorizados por el máximo órgano social y adecuadamente registrados.",
    riesgos: [
      { afirmacion: "Ocurrencia y presentación", descripcion: "Distribuciones de utilidades, capitalizaciones o apropiaciones sin autorización.", riesgo_inherente: "bajo", respuesta: "Cruce con actas de asamblea y certificado de existencia y representación legal." },
    ],
    procedimientos: [
      "Cruzar el capital con el certificado de existencia y representación legal.",
      "Verificar la distribución de utilidades y la reserva legal contra el acta de asamblea.",
      "Revisar el libro de registro de accionistas o socios.",
    ],
  },
  {
    ref: "L",
    titulo: "Ingresos de actividades ordinarias",
    rubros: ["ingresos_ordinarios", "otros_ingresos", "ingresos_financieros"],
    objetivo: "Verificar la ocurrencia, el corte y la medición de los ingresos (riesgo de fraude presunto, NIA 240 párr. 26).",
    riesgos: [
      { afirmacion: "Ocurrencia y corte", descripcion: "Riesgo presunto de fraude en el reconocimiento de ingresos: ventas ficticias o registradas en el periodo equivocado.", riesgo_inherente: "alto", respuesta: "Pruebas de corte, conciliación con la facturación electrónica de la DIAN y procedimientos analíticos sustantivos." },
    ],
    procedimientos: [
      "Conciliar los ingresos contables con la facturación electrónica reportada a la DIAN y con las declaraciones de IVA.",
      "Realizar pruebas de corte de facturación alrededor del cierre.",
      "Aplicar procedimientos analíticos por mes, producto o cliente (NIA 520).",
      "Revisar notas crédito emitidas después del cierre.",
    ],
  },
  {
    ref: "M",
    titulo: "Costos y gastos",
    rubros: ["costo_ventas", "gastos_admin", "gastos_ventas", "otros_gastos", "costos_financieros"],
    objetivo: "Verificar la ocurrencia, la clasificación y el soporte de costos y gastos, y su deducibilidad fiscal.",
    riesgos: [
      { afirmacion: "Ocurrencia", descripcion: "Gastos sin soporte, no relacionados con la actividad o a nombre de terceros vinculados.", riesgo_inherente: "medio", respuesta: "Revisión de soportes de una muestra y procedimientos analíticos." },
    ],
    procedimientos: [
      "Aplicar procedimientos analíticos de gastos frente al periodo anterior y al presupuesto.",
      "Verificar soportes (factura electrónica, documento soporte) de una muestra de gastos (NIA 530).",
      "Revisar gastos con partes vinculadas y su aprobación.",
      "Evaluar la deducibilidad de gastos significativos (arts. 107 y 771-2 E.T.).",
    ],
  },
];

const GENERAL: { ref: string; titulo: string; objetivo: string; riesgo: Omit<RiskDraft, "riesgo_control" | "significativo">; procedimientos: string[] }[] = [
  {
    ref: "A",
    titulo: "Planeación y evaluación del control interno",
    objetivo: "Conocer la entidad y su entorno, evaluar el control interno y definir la estrategia del encargo (NIA 300 y 315).",
    riesgo: {
      area: "General",
      afirmacion: "Todas",
      descripcion: "Elusión de los controles por parte de la dirección (riesgo presunto de fraude, NIA 240 párr. 31).",
      riesgo_inherente: "alto",
      respuesta: "Pruebas a los asientos de diario manuales y de fin de periodo, revisión de estimaciones contables y de transacciones inusuales (NIA 240 párr. 32).",
    },
    procedimientos: [
      "Obtener conocimiento de la entidad, su entorno, su marco de información financiera y su control interno.",
      "Leer actas de asamblea y junta directiva del periodo y posteriores al cierre.",
      "Probar asientos de diario manuales y ajustes de fin de periodo (NIA 240).",
      "Indagar con la administración sobre riesgos de fraude e incumplimiento de normas (NIA 240 y 250).",
      "Comunicar las deficiencias significativas de control interno (NIA 265).",
    ],
  },
  {
    ref: "N",
    titulo: "Empresa en funcionamiento y hechos posteriores",
    objetivo: "Evaluar la hipótesis de negocio en marcha y los hechos posteriores al cierre (NIA 560 y 570).",
    riesgo: {
      area: "General",
      afirmacion: "Presentación y revelación",
      descripcion: "Incertidumbre material sobre la capacidad de continuar como empresa en funcionamiento no revelada.",
      riesgo_inherente: "medio",
      respuesta: "Evaluación de indicadores financieros y operativos, flujo de caja proyectado y planes de la administración (NIA 570).",
    },
    procedimientos: [
      "Evaluar indicadores de negocio en marcha: pérdidas recurrentes, patrimonio negativo, capital de trabajo negativo, incumplimientos.",
      "Revisar el flujo de caja proyectado y los planes de la administración.",
      "Verificar si la sociedad está incursa en causal de disolución (art. 457 C. de Co.).",
      "Revisar hechos posteriores al cierre hasta la fecha del informe (NIA 560).",
    ],
  },
  {
    ref: "O",
    titulo: "Cumplimiento legal y estatutario (art. 209 C. de Co.)",
    objetivo: "Obtener evidencia para el informe sobre otros requerimientos legales y reglamentarios.",
    riesgo: {
      area: "General",
      afirmacion: "Cumplimiento",
      descripcion: "Actos de los administradores que no se ajustan a los estatutos o a las decisiones de la asamblea; libros de actas o de accionistas desactualizados.",
      riesgo_inherente: "medio",
      respuesta: "Revisión de libros oficiales, actas, estatutos y del informe de gestión.",
    },
    procedimientos: [
      "Verificar que la contabilidad se lleve conforme a las normas legales y la técnica contable.",
      "Revisar que los actos de los administradores se ajusten a los estatutos y a las decisiones de la asamblea.",
      "Verificar que la correspondencia, los comprobantes, los libros de actas y de registro de accionistas se lleven y conserven debidamente.",
      "Verificar el pago oportuno de aportes al sistema de seguridad social integral (Decreto 1406 de 1999, art. 11).",
      "Verificar la concordancia del informe de gestión con los estados financieros y el cumplimiento de normas de propiedad intelectual y derechos de autor (Ley 603 de 2000).",
      "Verificar que la administración no haya entorpecido la libre circulación de las facturas (Ley 1676 de 2013, art. 87, par. 2).",
    ],
  },
];

const presentado = (lines: TBLine[], rubro: string, col: "saldo_final" | "saldo_anterior") => {
  const r = RUBRO_BY_KEY.get(rubro);
  const isResult = r?.section === "resultados";
  const sum = lines
    .filter((l) => l.rubro === rubro)
    .reduce((s, l) => s + (isResult ? (col === "saldo_final" ? Number(l.saldo_final) - Number(l.saldo_anterior) : 0) : Number(l[col])), 0);
  return r?.nature === "credit" ? -sum : sum;
};

/** Señales de alerta detectadas en el balance (procedimientos analíticos preliminares, NIA 315). */
export function redFlags(lines: TBLine[], materialidadEjecucion: number): string[] {
  const flags: string[] = [];
  for (const l of lines) {
    const r = RUBRO_BY_KEY.get(l.rubro);
    if (!r || r.section === "excluido" || r.section === "resultados") continue;
    const s = Number(l.saldo_final);
    const contra = r.nature === "debit" ? s < 0 : s > 0;
    // Cuentas correctoras (depreciación, deterioro) son de naturaleza contraria por definición
    const isContra = /^1(2|3|4|5|6|7|8)\d{0,2}99|^159|^169/.test(l.account_code);
    if (contra && !isContra && Math.abs(s) >= Math.max(1, materialidadEjecucion * 0.05)) {
      flags.push(`Saldo contrario a su naturaleza en ${l.account_code} ${l.account_name}: ${Math.round(s).toLocaleString("es-CO")}.`);
    }
  }
  for (const key of RUBRO_BY_KEY.keys()) {
    const r = RUBRO_BY_KEY.get(key)!;
    // El resultado del ejercicio y las ganancias acumuladas cambian por el cierre anual, no son una señal
    if (r.section === "excluido" || r.section === "resultados" || key === "resultado_ejercicio" || key === "resultados_acumulados") continue;
    const cur = presentado(lines, key, "saldo_final");
    const prev = presentado(lines, key, "saldo_anterior");
    const delta = cur - prev;
    if (Math.abs(delta) >= materialidadEjecucion && prev !== 0 && Math.abs(delta / prev) >= 0.3) {
      flags.push(`Variación significativa en ${r.label.toLowerCase()}: ${(delta / Math.abs(prev) * 100).toFixed(0)} % (${Math.round(delta).toLocaleString("es-CO")}).`);
    }
  }
  if (lines.some((l) => l.account_code.startsWith("19") && Number(l.saldo_final) !== 0)) {
    flags.push("Hay valorizaciones (cuenta 19) que no proceden bajo el marco NIIF aplicable.");
  }
  return flags.slice(0, 25);
}

/** Matriz de riesgos y papeles de trabajo propuestos según los saldos y la materialidad. */
export function generatePlan(lines: TBLine[], materialidadEjecucion: number): { risks: RiskDraft[]; workpapers: WorkpaperDraft[] } {
  const risks: RiskDraft[] = [];
  const workpapers: WorkpaperDraft[] = [];
  const significant = (rubros: string[]) =>
    rubros.some((k) => Math.abs(presentado(lines, k, "saldo_final")) >= materialidadEjecucion);
  const present = (rubros: string[]) => rubros.some((k) => presentado(lines, k, "saldo_final") !== 0 || presentado(lines, k, "saldo_anterior") !== 0);

  const general = GENERAL[0];
  workpapers.push({ ref: `${general.ref}-1`, area: general.titulo, titulo: general.titulo, objetivo: general.objetivo, procedimientos: general.procedimientos.map((p, i) => `${i + 1}. ${p}`).join("\n") });
  risks.push({ ...general.riesgo, riesgo_control: "medio", significativo: true });

  for (const area of AREAS) {
    const isRevenue = area.ref === "L";
    if (!present(area.rubros)) continue;
    const sig = isRevenue || significant(area.rubros);
    for (const r of area.riesgos) {
      risks.push({
        area: area.titulo,
        ...r,
        riesgo_control: "medio",
        significativo: sig && (r.riesgo_inherente === "alto" || isRevenue),
      });
    }
    workpapers.push({
      ref: `${area.ref}-1`,
      area: area.titulo,
      titulo: area.titulo + (sig ? "" : " (área no significativa: procedimientos analíticos)"),
      objetivo: area.objetivo,
      procedimientos: (sig ? area.procedimientos : ["Aplicar procedimientos analíticos sustantivos y comparar con el periodo anterior (NIA 520)."]).map((p, i) => `${i + 1}. ${p}`).join("\n"),
    });
  }

  for (const g of GENERAL.slice(1)) {
    risks.push({ ...g.riesgo, riesgo_control: "medio", significativo: g.ref === "N" ? false : true });
    workpapers.push({ ref: `${g.ref}-1`, area: g.titulo, titulo: g.titulo, objetivo: g.objetivo, procedimientos: g.procedimientos.map((p, i) => `${i + 1}. ${p}`).join("\n") });
  }
  return { risks, workpapers };
}
