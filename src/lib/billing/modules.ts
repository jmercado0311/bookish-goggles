/** Días de prueba gratis con todos los módulos para cada despacho nuevo. */
export const TRIAL_DAYS = 14;

/** Planes de pago anticipado: meses y descuento sobre el precio mensual. */
export const BILLING_PERIODS = [
  { months: 1, discount: 0, label: "1 mes" },
  { months: 6, discount: 0.1, label: "6 meses (-10%)" },
  { months: 12, discount: 0.2, label: "12 meses (-20%)" },
] as const;

export function periodPrice(monthlyPriceCop: number, months: number): number {
  const period = BILLING_PERIODS.find((p) => p.months === months);
  if (!period) throw new Error("Periodo de pago no válido");
  return Math.round(monthlyPriceCop * months * (1 - period.discount));
}

export function formatCop(value: number): string {
  return value.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

/** ¿La vigencia (fecha ISO) sigue activa? */
export function isActiveUntil(activeUntil: string | null | undefined): boolean {
  return Boolean(activeUntil && new Date(activeUntil).getTime() > Date.now());
}

/** Días que faltan para la fecha (negativo si ya pasó). */
export function daysUntilDate(activeUntil: string): number {
  return Math.ceil((new Date(activeUntil).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

/** ¿La fecha ISO cae dentro de los últimos `days` días? */
export function withinLastDays(iso: string, days: number): boolean {
  return new Date(iso).getTime() >= Date.now() - days * 24 * 60 * 60 * 1000;
}
