import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { RecMovement } from "./reconcile";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface StoredMovement extends RecMovement {
  row_number: number;
  tercero: string;
  nit: string;
  cuenta: string;
  cuenta_nombre: string;
  debito: number;
  credito: number;
  saldo: number | null;
}

/** Movimientos de un extracto o auxiliar (paginado: Supabase devuelve máximo 1.000 filas). */
export async function loadMovements(supabase: Supabase, importId: string, cuentaPrefix?: string | null): Promise<StoredMovement[]> {
  const all: StoredMovement[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase
      .from("ledger_movements")
      .select("id, row_number, fecha, descripcion, documento, tercero, nit, cuenta, cuenta_nombre, debito, credito, saldo, valor")
      .eq("import_id", importId);
    if (cuentaPrefix) q = q.like("cuenta", `${cuentaPrefix.replace(/[%_]/g, "")}%`);
    const { data } = await q.order("fecha").order("row_number").range(from, from + 999);
    const page = (data ?? []).map((m) => ({
      ...m,
      debito: Number(m.debito),
      credito: Number(m.credito),
      saldo: m.saldo === null ? null : Number(m.saldo),
      valor: Number(m.valor),
    })) as StoredMovement[];
    all.push(...page);
    if (page.length < 1000) return all;
  }
}
