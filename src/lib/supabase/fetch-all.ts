import type { SupabaseClient } from "@supabase/supabase-js";

/** Lee todas las filas de una tabla por años: Supabase devuelve máximo 1.000 por consulta. */
export async function fetchAllByYears<T>(
  client: SupabaseClient,
  table: string,
  years: number[]
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .in("year", years)
      .order("id")
      .range(from, from + 999);
    if (error || !data) return all;
    all.push(...(data as T[]));
    if (data.length < 1000) return all;
  }
}
