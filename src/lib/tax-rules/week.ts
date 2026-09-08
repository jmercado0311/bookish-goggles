/** Lunes de la semana actual (hora local del servidor). */
export function currentMonday(from: Date = new Date()): Date {
  const day = from.getDay(); // 0 = domingo, 1 = lunes, ...
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(from.getFullYear(), from.getMonth(), from.getDate() + diff);
  return monday;
}
