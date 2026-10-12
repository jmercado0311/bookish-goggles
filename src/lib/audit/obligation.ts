/**
 * ¿La empresa está obligada a tener revisor fiscal? Sugerencia para el
 * contador, que siempre confirma (puede haber norma especial o estatutos).
 *
 * - Art. 203 C. de Co.: sociedades por acciones (anónimas y en comandita por
 *   acciones) y sucursales de compañías extranjeras.
 * - Par. 2 del art. 13 de la Ley 43 de 1990: sociedades con activos brutos al
 *   31 de diciembre del año anterior iguales o superiores a 5.000 SMMLV o
 *   ingresos brutos del año anterior iguales o superiores a 3.000 SMMLV
 *   (incluye las SAS: la Ley 1258 de 2008 no las obliga por su tipo).
 * - Normas especiales: cooperativas, entidades vigiladas por
 *   superintendencias, algunas ESAL y la propiedad horizontal de uso
 *   comercial o mixto, entre otras.
 */

export const TIPOS_SOCIETARIOS = [
  { value: "sas", label: "Sociedad por acciones simplificada (SAS)" },
  { value: "anonima", label: "Sociedad anónima (S.A.)" },
  { value: "comandita_acciones", label: "Comandita por acciones (S.C.A.)" },
  { value: "limitada", label: "Sociedad limitada (Ltda.)" },
  { value: "comandita_simple", label: "Comandita simple (S. en C.)" },
  { value: "colectiva", label: "Sociedad colectiva" },
  { value: "sucursal_extranjera", label: "Sucursal de sociedad extranjera" },
  { value: "cooperativa", label: "Cooperativa" },
  { value: "esal", label: "Entidad sin ánimo de lucro (ESAL)" },
  { value: "propiedad_horizontal", label: "Propiedad horizontal" },
  { value: "persona_natural", label: "Persona natural comerciante" },
  { value: "otra", label: "Otra" },
] as const;

/** Salario mínimo mensual legal vigente por año (para los topes de la Ley 43). */
export const SMMLV: Record<number, number> = {
  2023: 1160000,
  2024: 1300000,
  2025: 1423500,
};

export function smmlvFor(year: number): { year: number; value: number } {
  const years = Object.keys(SMMLV).map(Number).sort();
  const y = SMMLV[year] ? year : years.filter((x) => x <= year).pop() ?? years[years.length - 1];
  return { year: y, value: SMMLV[y] };
}

export interface ObligationResult {
  /** true: obligada; false: no por ley general; null: depende de norma especial o estatutos. */
  obligada: boolean | null;
  razones: string[];
}

export function evaluateObligation(input: {
  tipo: string | null;
  activosBrutos?: number | null;
  ingresosBrutos?: number | null;
  smmlv: number;
}): ObligationResult {
  const razones: string[] = [];
  if (input.tipo === "anonima" || input.tipo === "comandita_acciones" || input.tipo === "sucursal_extranjera") {
    razones.push("Por su tipo societario está obligada (art. 203 C. de Co.).");
    return { obligada: true, razones };
  }
  if (input.tipo === "cooperativa" || input.tipo === "esal" || input.tipo === "propiedad_horizontal") {
    razones.push(
      "Depende de su norma especial y estatutos (por ejemplo, las cooperativas y la propiedad horizontal de uso comercial o mixto suelen estar obligadas)."
    );
  }
  const activos = input.activosBrutos ?? null;
  const ingresos = input.ingresosBrutos ?? null;
  const topeActivos = 5000 * input.smmlv;
  const topeIngresos = 3000 * input.smmlv;
  const fmt = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

  if (input.tipo !== "persona_natural") {
    if (activos !== null && activos >= topeActivos) {
      razones.push(`Activos brutos (${fmt(activos)}) iguales o superiores a 5.000 SMMLV (${fmt(topeActivos)}) — par. 2, art. 13, Ley 43 de 1990.`);
    }
    if (ingresos !== null && ingresos >= topeIngresos) {
      razones.push(`Ingresos brutos (${fmt(ingresos)}) iguales o superiores a 3.000 SMMLV (${fmt(topeIngresos)}) — par. 2, art. 13, Ley 43 de 1990.`);
    }
  }
  if (razones.some((r) => r.includes("Ley 43"))) return { obligada: true, razones };
  if (razones.length) return { obligada: null, razones };

  if (activos === null && ingresos === null) {
    return { obligada: null, razones: ["Indica activos e ingresos brutos del año anterior para evaluar los topes de la Ley 43 de 1990."] };
  }
  razones.push(
    input.tipo === "persona_natural"
      ? "Las personas naturales comerciantes no están obligadas por la ley general."
      : `No supera los topes de la Ley 43 de 1990 (activos < ${fmt(topeActivos)} e ingresos < ${fmt(topeIngresos)}). Puede tenerlo por estatutos.`
  );
  return { obligada: false, razones };
}
