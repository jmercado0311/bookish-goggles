/**
 * Catálogo de códigos de "Responsabilidades, Calidades y Atributos" del RUT (DIAN),
 * casilla 53 del formulario 001. Referencia real usada: RUT de Julio César Miranda
 * Frías (Almacampo de La Guajira), que trae los códigos 05, 07, 22, 33, 42, 48, 52.
 */
export const RUT_RESPONSIBILITY_CODES = {
  "01": "Aporte especial para la administración de justicia",
  "02": "Gravamen a los movimientos financieros",
  "03": "Agente de retención en el impuesto sobre las ventas",
  "04": "Impuesto de timbre",
  "05": "Impuesto de renta y complementarios régimen ordinario",
  "06": "Ingresos y patrimonio",
  "07": "Retención en la fuente a título de renta",
  "08": "Impuesto de renta y complementarios régimen especial",
  "09": "Retención en la fuente en el impuesto sobre las ventas",
  "10": "Gran contribuyente",
  "11": "Ventas régimen simplificado",
  "13": "Gran contribuyente - régimen tributario especial",
  "14": "Informante de exógena",
  "15": "Autorretenedor",
  "16": "Obligación a facturar por ingresos bienes y/o servicios excluidos",
  "19": "Productor de bienes y/o servicios exentos (bienes)",
  "20": "Obtención NIT",
  "21": "Régimen simple de tributación - SIMPLE",
  "22": "Obligado a cumplir deberes formales a nombre de terceros",
  "23": "Agente de retención en el impuesto sobre las ventas",
  "24": "No responsable de IVA",
  "25": "Impuesto nacional a la gasolina y ACPM",
  "26": "Impuesto nacional al carbono",
  "31": "Impuesto sobre la renta y complementario del régimen SIMPLE",
  "32": "Impuesto sobre las ventas - IVA - responsable",
  "33": "Impuesto nacional al consumo",
  "34": "No responsable de impuesto nacional al consumo de restaurantes y bares",
  "35": "Impuesto nacional al consumo de bolsas plásticas",
  "36": "Establecimiento permanente",
  "42": "Obligado a llevar contabilidad",
  "48": "Impuesto sobre las ventas - IVA",
  "49": "No responsable IVA",
  "52": "Facturador electrónico",
  "54": "Titular de inversión extranjera directa",
  "55": "Titular de inversión extranjera de portafolio",
  "62": "Obligado a declarar activos en el exterior",
  "63": "Régimen de compañías holding colombianas - CHC",
  "80": "Otros deberes: renta por cambio de titular de inversión extranjera",
} as const;

export type ResponsibilityCode = keyof typeof RUT_RESPONSIBILITY_CODES;

/** Códigos que efectivamente disparan un vencimiento en el calendario tributario. */
export const RESPONSIBILITIES_WITH_DEADLINES: ResponsibilityCode[] = [
  "05", // Renta régimen ordinario
  "07", // Retención en la fuente a título de renta
  "09", // Retención en la fuente - IVA
  "15", // Autorretenedor
  "21", // Régimen Simple
  "31", // Renta régimen SIMPLE
  "32", // IVA
  "48", // IVA (código histórico)
  "33", // Impuesto nacional al consumo
];

export function responsibilityName(code: string): string {
  return RUT_RESPONSIBILITY_CODES[code as ResponsibilityCode] ?? `Responsabilidad ${code}`;
}
