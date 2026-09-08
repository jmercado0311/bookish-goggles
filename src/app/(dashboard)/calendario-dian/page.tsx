import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import type { CalendarUpload } from "@/lib/types";

export default async function CalendarioDianPage() {
  const { supabase } = await requireAdmin();

  const { data: uploads } = await supabase
    .from("calendar_uploads")
    .select("*")
    .order("uploaded_at", { ascending: false });

  const { data: years } = await supabase
    .from("tax_calendar")
    .select("year")
    .order("year", { ascending: false });

  const distinctYears = [...new Set((years ?? []).map((y) => y.year))];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Calendario DIAN</h1>
          <p className="text-sm text-slate-500">
            Sube el PDF oficial cada año (o cuando cambie). Las fechas siempre pasan por
            revisión tuya antes de aplicarse.
          </p>
        </div>
        <Link
          href="/calendario-dian/nuevo"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Cargar calendario
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {distinctYears.map((y) => (
          <span
            key={y}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600"
          >
            Calendario {y} cargado
          </span>
        ))}
        {distinctYears.length === 0 && (
          <p className="text-sm text-slate-500">Todavía no has cargado ningún calendario.</p>
        )}
      </div>

      <div className="space-y-2">
        {((uploads ?? []) as CalendarUpload[]).map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
          >
            <span>
              Año {u.year} · {u.status === "confirmado" ? "Confirmado" : "Pendiente de revisión"}
            </span>
            <span className="text-xs text-slate-400">
              {new Date(u.uploaded_at).toLocaleDateString("es-CO")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
