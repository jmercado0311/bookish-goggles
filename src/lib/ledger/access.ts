import "server-only";
import { hasModule } from "@/lib/auth";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Importar extractos y auxiliares lo permiten los módulos de conciliaciones y de revisoría fiscal. */
export async function canUseLedgerTools(supabase: Supabase): Promise<boolean> {
  const [conciliaciones, revisoria] = await Promise.all([
    hasModule(supabase, "conciliaciones"),
    hasModule(supabase, "revisoria"),
  ]);
  return conciliaciones || revisoria;
}
