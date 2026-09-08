export type UrgencyLevel = "vencido" | "urgente" | "proximo" | "normal";

/** Días de anticipación que se le pide al equipo tener la información lista. */
export const DIAS_ANTICIPACION_REQUERIDA = 4;

/** Umbral (días) para marcar un vencimiento como "urgente" en la vista y el correo. */
export const DIAS_UMBRAL_URGENTE = 2;

export function daysUntil(dueDate: string, from: Date = new Date()): number {
  const due = new Date(dueDate + "T00:00:00");
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const ms = due.getTime() - today.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function urgencyLevel(dueDate: string, from: Date = new Date()): UrgencyLevel {
  const days = daysUntil(dueDate, from);
  if (days < 0) return "vencido";
  if (days <= DIAS_UMBRAL_URGENTE) return "urgente";
  if (days <= DIAS_ANTICIPACION_REQUERIDA) return "proximo";
  return "normal";
}

/** Vencimientos de la semana (lunes a domingo) que arranca en `monday`. */
export function isWithinWeek(dueDate: string, monday: Date): boolean {
  const due = new Date(dueDate + "T00:00:00");
  const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return due >= start && due <= end;
}
