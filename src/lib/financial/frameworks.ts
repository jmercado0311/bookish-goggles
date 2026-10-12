/**
 * Marcos técnicos normativos del DUR 2420 de 2015 y lo que cada uno exige
 * en la presentación de los estados financieros. La app arma el juego de
 * estados, sus títulos, las notas y la lista de verificación a partir de
 * esta definición, según el grupo al que pertenece la empresa.
 */

export type Framework = "grupo1" | "grupo2" | "grupo3";

export interface FrameworkSpec {
  key: Framework;
  short: string;
  label: string;
  /** Títulos de los estados del juego completo; null = el marco no lo exige. */
  statements: {
    situacion: string;
    resultados: string;
    patrimonio: string | null;
    flujos: string | null;
  };
  /** Referencia normativa del juego completo de estados financieros. */
  juegoCompletoRef: string;
  /** Exigencia de información comparativa. */
  comparativo: { exigido: boolean; ref: string };
  /** Presenta otro resultado integral (ORI). */
  ori: boolean;
  /** Divide el ORI en partidas que se reclasificarán o no (NIC 1.82A). */
  oriDividido: boolean;
  /** El marco permite reconocer impuesto diferido. */
  impuestoDiferido: boolean;
  /** Revelar gastos por naturaleza cuando se clasifican por función (NIC 1.104). */
  gastosPorNaturaleza: boolean;
  /** Declaración explícita y sin reservas de cumplimiento. */
  declaracionCumplimiento: string | null;
}

export const FRAMEWORKS: Record<Framework, FrameworkSpec> = {
  grupo1: {
    key: "grupo1",
    short: "Grupo 1 · NIIF plenas",
    label: "Grupo 1 - NIIF plenas (Anexo 1 del Decreto 2420 de 2015)",
    statements: {
      situacion: "Estado de situación financiera",
      resultados: "Estado del resultado del periodo y otro resultado integral",
      patrimonio: "Estado de cambios en el patrimonio",
      flujos: "Estado de flujos de efectivo",
    },
    juegoCompletoRef: "NIC 1, párrafo 10",
    comparativo: { exigido: true, ref: "NIC 1, párrafo 38" },
    ori: true,
    oriDividido: true,
    impuestoDiferido: true,
    gastosPorNaturaleza: true,
    declaracionCumplimiento:
      "La entidad declara de forma explícita y sin reservas que estos estados financieros cumplen con las Normas Internacionales de Información Financiera (NIIF) incorporadas en Colombia (NIC 1, párrafo 16).",
  },
  grupo2: {
    key: "grupo2",
    short: "Grupo 2 · NIIF para las PYMES",
    label: "Grupo 2 - NIIF para las PYMES (Anexo 2 del Decreto 2420 de 2015)",
    statements: {
      situacion: "Estado de situación financiera",
      resultados: "Estado del resultado integral",
      patrimonio: "Estado de cambios en el patrimonio",
      flujos: "Estado de flujos de efectivo",
    },
    juegoCompletoRef: "NIIF para las PYMES, Sección 3, párrafo 3.17",
    comparativo: { exigido: true, ref: "NIIF para las PYMES, párrafo 3.14" },
    ori: true,
    oriDividido: false,
    impuestoDiferido: true,
    gastosPorNaturaleza: false,
    declaracionCumplimiento:
      "La entidad declara de forma explícita y sin reservas que estos estados financieros cumplen con la NIIF para las PYMES incorporada en Colombia (NIIF para las PYMES, párrafo 3.3).",
  },
  grupo3: {
    key: "grupo3",
    short: "Grupo 3 · Microempresas",
    label: "Grupo 3 - Microempresas (Anexo 3 del Decreto 2420 de 2015)",
    statements: {
      situacion: "Estado de situación financiera",
      resultados: "Estado de resultados",
      patrimonio: null,
      flujos: null,
    },
    juegoCompletoRef: "Marco técnico normativo para microempresas (Anexo 3 del Decreto 2420 de 2015)",
    comparativo: { exigido: false, ref: "Anexo 3 del Decreto 2420 de 2015" },
    ori: false,
    oriDividido: false,
    impuestoDiferido: false,
    gastosPorNaturaleza: false,
    declaracionCumplimiento: null,
  },
};

export const FRAMEWORK_LABEL: Record<Framework, string> = {
  grupo1: FRAMEWORKS.grupo1.label,
  grupo2: FRAMEWORKS.grupo2.label,
  grupo3: FRAMEWORKS.grupo3.label,
};

export function isFramework(value: unknown): value is Framework {
  return value === "grupo1" || value === "grupo2" || value === "grupo3";
}

/**
 * Guía para que el contador elija el grupo (Decreto 2420 de 2015 y sus
 * modificaciones). Es orientativa: la clasificación definitiva la determina
 * el contador con los requisitos vigentes de cada grupo.
 */
export const FRAMEWORK_GUIDE: Record<Framework, string> = {
  grupo1:
    "Emisores de valores, entidades de interés público (bancos, aseguradoras, fiduciarias…) y entidades que cumplan los requisitos de tamaño y vínculo con el exterior del Decreto 2420 (subordinadas o matrices de compañías que aplican NIIF plenas, importaciones o exportaciones superiores al 50 %).",
  grupo2:
    "Empresas que no cumplen los requisitos del Grupo 1 ni del Grupo 3. Es el grupo de la mayoría de las sociedades del país.",
  grupo3:
    "Microempresas: personas naturales o jurídicas con planta de personal no superior a 10 trabajadores y activos e ingresos dentro de los topes vigentes del Decreto 2420 de 2015 y sus modificaciones para el Grupo 3.",
};
