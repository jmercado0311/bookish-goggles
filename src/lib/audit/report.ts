import { FRAMEWORKS, type Framework } from "@/lib/financial/frameworks";

/**
 * Borradores del dictamen del revisor fiscal (NIA 700, 705 y 706 adoptadas
 * por el Anexo 4 del Decreto 2420 de 2015), del informe del artículo 209 del
 * Código de Comercio y de la carta de representación (NIA 580). Cada
 * sección es editable; lo editado se guarda en audit_documents.
 */

export type Opinion = "favorable" | "con_salvedades" | "desfavorable" | "abstencion";

export const OPINION_LABEL: Record<Opinion, string> = {
  favorable: "Favorable (sin salvedades)",
  con_salvedades: "Con salvedades",
  desfavorable: "Desfavorable (adversa)",
  abstencion: "Abstención de opinión",
};

export interface ReportContext {
  razonSocial: string;
  nit: string;
  ciudad: string;
  periodEnd: string;
  framework: Framework;
  revisorNombre: string;
  revisorTp: string;
  firmaDesignante: string | null;
  fechaInforme: string | null;
  opinion: Opinion;
  /** Descripción de las incorrecciones o limitaciones que fundamentan una opinión modificada. */
  fundamentoModificacion: string;
  incorreccionesNoCorregidas: number;
  materialidadGlobal: number;
  deficienciasControl: string[];
  incumplimientos: string[];
}

export interface DocSection {
  key: string;
  title: string;
  text: string;
  edited: boolean;
}

const fecha = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" }) : "[fecha del informe]";
const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

/** Opinión sugerida a partir de las incorrecciones no corregidas frente a la materialidad (NIA 450 y 705). */
export function suggestOpinion(noCorregidas: number, materialidadGlobal: number, generalizado: boolean): Opinion {
  if (materialidadGlobal <= 0 || Math.abs(noCorregidas) < materialidadGlobal) return "favorable";
  return generalizado ? "desfavorable" : "con_salvedades";
}

function estadosTexto(f: Framework, fechaCierre: string): string {
  const st = FRAMEWORKS[f].statements;
  const otros = [st.resultados, st.patrimonio, st.flujos].filter(Boolean).map((t) => `el ${t!.toLowerCase()}`);
  const lista = otros.length > 1 ? `${otros.slice(0, -1).join(", ")} y ${otros[otros.length - 1]}` : otros[0];
  return `el ${st.situacion.toLowerCase()} al ${fechaCierre}, ${lista} ${otros.length > 1 ? "correspondientes" : "correspondiente"} al ejercicio terminado en dicha fecha, así como las notas explicativas que incluyen un resumen de las políticas contables significativas`;
}

/** "la situación financiera de X al <fecha>, así como sus resultados [y sus flujos de efectivo]" */
function presentanTexto(f: Framework, razonSocial: string, fechaCierre: string): string {
  const resultados = FRAMEWORKS[f].statements.flujos ? "sus resultados y sus flujos de efectivo" : "sus resultados";
  return `la situación financiera de ${razonSocial} al ${fechaCierre}, así como ${resultados} correspondientes al ejercicio terminado en dicha fecha`;
}

export function buildDictamen(ctx: ReportContext, overrides: Record<string, string>): DocSection[] {
  const cierre = fecha(ctx.periodEnd);
  const marco = `las Normas de Contabilidad y de Información Financiera aceptadas en Colombia, correspondientes al ${FRAMEWORKS[ctx.framework].label}`;
  const sections: DocSection[] = [];
  const add = (key: string, title: string, text: string) =>
    sections.push({ key, title, text: overrides[key] ?? text, edited: overrides[key] !== undefined });

  const tituloOpinion = {
    favorable: "Opinión",
    con_salvedades: "Opinión con salvedades",
    desfavorable: "Opinión desfavorable",
    abstencion: "Abstención de opinión",
  }[ctx.opinion];

  add("destinatario", "Destinatario", `Señores\nAsamblea General de Accionistas (Junta de Socios)\n${ctx.razonSocial}\n${ctx.ciudad || "[ciudad]"}`);

  const opinionText = {
    favorable: `He auditado los estados financieros de ${ctx.razonSocial} (NIT ${ctx.nit}), que comprenden ${estadosTexto(ctx.framework, cierre)}.\n\nEn mi opinión, los estados financieros adjuntos, tomados fielmente de los libros de contabilidad, presentan razonablemente, en todos los aspectos materiales, ${presentanTexto(ctx.framework, ctx.razonSocial, cierre)}, de conformidad con ${marco}.`,
    con_salvedades: `He auditado los estados financieros de ${ctx.razonSocial} (NIT ${ctx.nit}), que comprenden ${estadosTexto(ctx.framework, cierre)}.\n\nEn mi opinión, excepto por los efectos de la cuestión descrita en la sección Fundamento de la opinión con salvedades, los estados financieros adjuntos presentan razonablemente, en todos los aspectos materiales, ${presentanTexto(ctx.framework, ctx.razonSocial, cierre)}, de conformidad con ${marco}.`,
    desfavorable: `He auditado los estados financieros de ${ctx.razonSocial} (NIT ${ctx.nit}), que comprenden ${estadosTexto(ctx.framework, cierre)}.\n\nEn mi opinión, debido a la significatividad de la cuestión descrita en la sección Fundamento de la opinión desfavorable, los estados financieros adjuntos no presentan razonablemente ${presentanTexto(ctx.framework, ctx.razonSocial, cierre)}, de conformidad con ${marco}.`,
    abstencion: `Fui designado para auditar los estados financieros de ${ctx.razonSocial} (NIT ${ctx.nit}), que comprenden ${estadosTexto(ctx.framework, cierre)}.\n\nNo expreso una opinión sobre los estados financieros adjuntos de la entidad. Debido a la significatividad de la cuestión descrita en la sección Fundamento de la abstención de opinión, no he podido obtener evidencia de auditoría que proporcione una base suficiente y adecuada para expresar una opinión sobre dichos estados financieros.`,
  }[ctx.opinion];
  add("opinion", tituloOpinion, opinionText);

  const basePorDefecto =
    "He llevado a cabo mi auditoría de conformidad con las Normas Internacionales de Auditoría (NIA) aceptadas en Colombia, incorporadas en el Anexo 4 del Decreto 2420 de 2015 y sus modificatorios. Mis responsabilidades de acuerdo con dichas normas se describen más adelante en la sección Responsabilidades del revisor fiscal en relación con la auditoría de los estados financieros. Soy independiente de la entidad de conformidad con el Código de Ética para Profesionales de la Contabilidad incorporado en el Anexo 4 del Decreto 2420 de 2015 y con los requerimientos de ética de la Ley 43 de 1990, y he cumplido las demás responsabilidades de ética de conformidad con esos requerimientos.";

  if (ctx.opinion === "favorable") {
    add("fundamento", "Fundamento de la opinión", `${basePorDefecto} Considero que la evidencia de auditoría que he obtenido proporciona una base suficiente y adecuada para mi opinión.`);
  } else if (ctx.opinion === "abstencion") {
    add("fundamento", "Fundamento de la abstención de opinión", `${ctx.fundamentoModificacion || "[Describa la limitación al alcance que impidió obtener evidencia suficiente y adecuada, y sus posibles efectos.]"}`);
  } else {
    add(
      "fundamento",
      ctx.opinion === "con_salvedades" ? "Fundamento de la opinión con salvedades" : "Fundamento de la opinión desfavorable",
      `${ctx.fundamentoModificacion || `[Describa la(s) incorrección(es) material(es) y cuantifique sus efectos. Incorrecciones no corregidas identificadas: ${pesos(ctx.incorreccionesNoCorregidas)}; materialidad global: ${pesos(ctx.materialidadGlobal)}.]`}\n\n${basePorDefecto} Considero que la evidencia de auditoría que he obtenido proporciona una base suficiente y adecuada para mi opinión ${ctx.opinion === "con_salvedades" ? "con salvedades" : "desfavorable"}.`
    );
  }

  // Opcional: vacío por defecto para que no se imprima un texto de ayuda en el dictamen
  add("enfasis", "Párrafo de énfasis", "");

  add(
    "responsabilidades_direccion",
    "Responsabilidades de la administración y de los responsables del gobierno de la entidad en relación con los estados financieros",
    `La administración es responsable de la preparación y presentación fiel de los estados financieros adjuntos de conformidad con ${marco}, y del control interno que considere necesario para permitir la preparación de estados financieros libres de incorrección material, debida a fraude o error.\n\nEn la preparación de los estados financieros, la administración es responsable de la valoración de la capacidad de la entidad de continuar como empresa en funcionamiento, revelando, según corresponda, las cuestiones relacionadas con la empresa en funcionamiento y utilizando el principio contable de empresa en funcionamiento, excepto si tiene intención de liquidar la entidad o de cesar sus operaciones, o bien no exista otra alternativa realista.\n\nLos responsables del gobierno de la entidad son responsables de la supervisión del proceso de información financiera de la entidad.`
  );

  add(
    "responsabilidades_revisor",
    "Responsabilidades del revisor fiscal en relación con la auditoría de los estados financieros",
    "Mis objetivos son obtener una seguridad razonable de que los estados financieros en su conjunto están libres de incorrección material, debida a fraude o error, y emitir un informe que contenga mi opinión. Seguridad razonable es un alto grado de seguridad, pero no garantiza que una auditoría realizada de conformidad con las NIA siempre detecte una incorrección material cuando existe.\n\nComo parte de una auditoría de conformidad con las NIA, aplico mi juicio profesional y mantengo una actitud de escepticismo profesional durante toda la auditoría. También:\n• Identifico y valoro los riesgos de incorrección material en los estados financieros, debida a fraude o error, diseño y aplico procedimientos de auditoría para responder a dichos riesgos y obtengo evidencia suficiente y adecuada para proporcionar una base para mi opinión.\n• Obtengo conocimiento del control interno relevante para la auditoría, con el fin de diseñar procedimientos adecuados en función de las circunstancias.\n• Evalúo la adecuación de las políticas contables aplicadas, la razonabilidad de las estimaciones contables y la correspondiente información revelada por la administración.\n• Concluyo sobre lo adecuado de la utilización, por la administración, del principio contable de empresa en funcionamiento.\n• Evalúo la presentación global, la estructura y el contenido de los estados financieros, incluida la información revelada.\n\nMe comunico con los responsables del gobierno de la entidad en relación con, entre otras cuestiones, el alcance y el momento de realización de la auditoría planificados y los hallazgos significativos, así como cualquier deficiencia significativa del control interno que identifique en el transcurso de la auditoría."
  );

  const otros = [
    "Además, informo que durante el ejercicio la contabilidad de la entidad se llevó conforme a las normas legales y a la técnica contable; las operaciones registradas en los libros y los actos de los administradores se ajustan a los estatutos y a las decisiones de la asamblea; la correspondencia, los comprobantes de las cuentas y los libros de actas y de registro de accionistas se llevan y se conservan debidamente; el informe de gestión de la administración guarda la debida concordancia con los estados financieros, e incluye la manifestación sobre el cumplimiento de las normas de propiedad intelectual y derechos de autor (Ley 603 de 2000) y sobre la no obstaculización de la libre circulación de las facturas (Ley 1676 de 2013); y la entidad ha efectuado en forma correcta y oportuna sus aportes al sistema de seguridad social integral (Decreto 1406 de 1999, art. 11).",
    ctx.incumplimientos.length
      ? `Excepciones identificadas:\n${ctx.incumplimientos.map((i) => `• ${i}`).join("\n")}`
      : "",
    `En cumplimiento de los numerales 1 y 3 del artículo 209 del Código de Comercio, he emitido un informe separado sobre si los actos de los administradores se ajustan a los estatutos y a las órdenes o instrucciones de la asamblea, y si hay y son adecuadas las medidas de control interno, de conservación y custodia de los bienes de la entidad o de terceros que estén en su poder.`,
  ]
    .filter(Boolean)
    .join("\n\n");
  add("otros_requerimientos", "Informe sobre otros requerimientos legales y reglamentarios", otros);

  add(
    "firma",
    "Firma",
    `${ctx.revisorNombre || "[Nombre del revisor fiscal]"}\nRevisor Fiscal\nT.P. ${ctx.revisorTp || "[número]"}${ctx.firmaDesignante ? `\nDesignado por ${ctx.firmaDesignante}` : ""}\n${ctx.ciudad || "[ciudad]"}, ${fecha(ctx.fechaInforme)}`
  );

  return sections;
}

export function buildArt209(ctx: ReportContext, overrides: Record<string, string>): DocSection[] {
  const sections: DocSection[] = [];
  const add = (key: string, title: string, text: string) =>
    sections.push({ key, title, text: overrides[key] ?? text, edited: overrides[key] !== undefined });
  const cierre = fecha(ctx.periodEnd);

  add(
    "209_introduccion",
    "Informe del revisor fiscal sobre el cumplimiento de los numerales 1 y 3 del artículo 209 del Código de Comercio",
    `Señores\nAsamblea General de Accionistas (Junta de Socios)\n${ctx.razonSocial}\n\nEn desarrollo de mis funciones de revisor fiscal y en cumplimiento de los numerales 1 y 3 del artículo 209 del Código de Comercio, informo sobre el ejercicio terminado el ${cierre}.`
  );
  add(
    "209_criterios",
    "Criterios",
    "Los criterios considerados para la evaluación son: a) los estatutos sociales y las actas de asamblea y de junta directiva, y b) los componentes del control interno implementados por la administración (ambiente de control, valoración de riesgos, sistemas de información, actividades de control y seguimiento)."
  );
  add(
    "209_procedimientos",
    "Procedimientos realizados",
    "Mi trabajo se efectuó de acuerdo con la Norma Internacional de Trabajos para Atestiguar ISAE 3000 incorporada en el Anexo 4 del Decreto 2420 de 2015, e incluyó, entre otros: la lectura de los estatutos y de las actas del periodo; la verificación de que los actos de los administradores se ajustaron a las decisiones de los órganos sociales; la indagación con la administración sobre cambios en el control interno; y pruebas de diseño e implementación de los controles relevantes sobre los procesos de la entidad."
  );
  const deficiencias = ctx.deficienciasControl.length
    ? `\n\nSin que afecte mi conclusión, comuniqué a la administración las siguientes recomendaciones de control interno:\n${ctx.deficienciasControl.map((d) => `• ${d}`).join("\n")}`
    : "";
  add(
    "209_conclusion",
    "Conclusión",
    `En mi opinión, los actos de los administradores de ${ctx.razonSocial} se ajustan a los estatutos y a las órdenes o instrucciones de la asamblea, y existen y son adecuadas las medidas de control interno, de conservación y custodia de los bienes de la entidad o de terceros que están en su poder, en todos los aspectos importantes, de acuerdo con los criterios indicados.${deficiencias}`
  );
  add(
    "209_firma",
    "Firma",
    `${ctx.revisorNombre || "[Nombre del revisor fiscal]"}\nRevisor Fiscal\nT.P. ${ctx.revisorTp || "[número]"}\n${ctx.ciudad || "[ciudad]"}, ${fecha(ctx.fechaInforme)}`
  );
  return sections;
}

export function buildRepresentationLetter(ctx: ReportContext, overrides: Record<string, string>): DocSection[] {
  const sections: DocSection[] = [];
  const add = (key: string, title: string, text: string) =>
    sections.push({ key, title, text: overrides[key] ?? text, edited: overrides[key] !== undefined });
  const cierre = fecha(ctx.periodEnd);

  add(
    "carta_cuerpo",
    "Carta de representación (NIA 580)",
    `${ctx.ciudad || "[ciudad]"}, ${fecha(ctx.fechaInforme)}\n\nSeñor(a)\n${ctx.revisorNombre || "[Nombre del revisor fiscal]"}\nRevisor Fiscal\n${ctx.razonSocial}\n\nEsta carta de manifestaciones se emite con relación a su auditoría de los estados financieros de ${ctx.razonSocial} al ${cierre}, con el propósito de expresar una opinión sobre si presentan razonablemente, en todos los aspectos materiales, de conformidad con ${FRAMEWORKS[ctx.framework].label}.\n\nConfirmamos, a nuestro leal saber y entender, las siguientes manifestaciones:\n\nEstados financieros\n1. Hemos cumplido nuestras responsabilidades sobre la preparación de los estados financieros de conformidad con el marco de información financiera aplicable; en particular, los estados financieros se presentan fielmente de conformidad con dicho marco.\n2. Las hipótesis significativas utilizadas en las estimaciones contables son razonables.\n3. Las relaciones y transacciones con partes vinculadas se han registrado y revelado adecuadamente.\n4. Todos los hechos posteriores a la fecha de los estados financieros que requieren ajuste o revelación han sido ajustados o revelados.\n5. Los efectos de las incorrecciones no corregidas son inmateriales, tanto individualmente como de forma agregada, para los estados financieros en su conjunto.\n\nInformación proporcionada\n6. Les hemos proporcionado acceso a toda la información relevante para la preparación de los estados financieros (registros, documentación, actas y otros), a la información adicional solicitada y a las personas de la entidad de las que consideraron necesario obtener evidencia.\n7. Todas las transacciones se han registrado en los registros contables y se reflejan en los estados financieros.\n8. Les hemos revelado los resultados de nuestra valoración del riesgo de fraude y toda la información relativa al fraude o indicios de fraude que conocemos.\n9. Les hemos revelado todos los casos conocidos de incumplimiento de disposiciones legales y reglamentarias, incluidas las tributarias, laborales y de seguridad social.\n10. Les hemos revelado los litigios y reclamaciones, reales o posibles, cuyos efectos deben considerarse al preparar los estados financieros.\n11. La entidad ha cumplido las normas de propiedad intelectual y derechos de autor sobre el software que utiliza (Ley 603 de 2000).`
  );
  add(
    "carta_firmas",
    "Firmas",
    "____________________________\n[Nombre]\nRepresentante legal\n\n____________________________\n[Nombre]\nContador público\nT.P. [número]"
  );
  return sections;
}
