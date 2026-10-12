import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { TBLine } from "@/lib/financial/statements";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Líneas del balance de prueba (paginado: Supabase devuelve máximo 1.000 filas). */
export async function loadTrialBalanceLines(supabase: Supabase, trialBalanceId: string): Promise<TBLine[]> {
  const all: TBLine[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("trial_balance_lines")
      .select("account_code, account_name, saldo_anterior, saldo_final, rubro")
      .eq("trial_balance_id", trialBalanceId)
      .order("account_code")
      .range(from, from + 999);
    const page = (data ?? []).map((l) => ({ ...l, saldo_anterior: Number(l.saldo_anterior), saldo_final: Number(l.saldo_final) })) as TBLine[];
    all.push(...page);
    if (page.length < 1000) return all;
  }
}
