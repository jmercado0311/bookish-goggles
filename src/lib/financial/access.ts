import "server-only";
import { hasModule } from "@/lib/auth";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Para importar o editar un balance basta con tener alguno de los tres módulos financieros. */
export async function hasAnyFinancialModule(supabase: Supabase): Promise<boolean> {
  const results = await Promise.all([
    hasModule(supabase, "estados_financieros"),
    hasModule(supabase, "notas"),
    hasModule(supabase, "indicadores"),
  ]);
  return results.some(Boolean);
}
