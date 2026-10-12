import Link from "next/link";
import { hasModule, requireAdmin } from "@/lib/auth";
import { fetchAllByYears } from "@/lib/supabase/fetch-all";
import { normalizeMunicipio } from "@/lib/tax-rules/ica-calendar";
import type { CompanyIca, IcaCalendarEntry } from "@/lib/types";
import { Paywall } from "../paywall";
import { DeleteIcaCalendarButton } from "./delete-button";

interface Group {
  municipio: string;
  year: number;
  periodicidad: string;
  fechas: number;
  porDigito: boolean;
  primera: string;
  ultima: string;
  archivo: string | null;
}

export default async function CalendarioIcaPage() {
  const { supabase } = await requireAdmin();
  if (!(await hasModule(supabase, "vencimientos"))) {
    return <Paywall moduleName="Vencimientos tributarios" isAdmin />;
  }

  const year = new Date().getFullYear();
  const years = [year - 1, year, year + 1];
  const [entries, { data: icas }] = await Promise.all([
    fetchAllByYears<IcaCalendarEntry>(supabase, "ica_calendar", years),
    supabase.from("company_ica").select("*"),
  ]);

  const groups = new Map<string, Group>();
  for (const e of entries) {
    const key = `${normalizeMunicipio(e.municipio)}|${e.year}|${e.periodicidad}`;
    const g = groups.get(key);
    if (!g) {
      groups.set(key, {
        municipio: e.municipio,
        year: e.year,
        periodicidad: e.periodicidad,
        fechas: 1,
        porDigito: e.last_nit_digit !== null,
        primera: e.due_date,
        ultima: e.due_date,
        archivo: e.source_file_name,
      });
    } else {
      g.fechas++;
      g.porDigito ||= e.last_nit_digit !== null;
      if (e.due_date < g.primera) g.primera = e.due_date;
      if (e.due_date > g.ultima) g.ultima = e.due_date;
    }
  }
  const list = [...groups.values()].sort(
    (a, b) => b.year - a.year || a.municipio.localeCompare(b.municipio, "es")
  );

  // Municipios de las empresas que todavía no tienen calendario del año en curso
  const conCalendario = new Set(
    list.filter((g) => g.year === year).map((g) => `${normalizeMunicipio(g.municipio)}|${g.periodicidad}`)
  );
  const pendientes = new Map<string, { municipio: string; periodicidad: string; empresas: number }>();
  for (const ica of (icas ?? []) as CompanyIca[]) {
    const key = `${normalizeMunicipio(ica.municipio)}|${ica.periodicidad}`;
    if (conCalendario.has(key)) continue;
    const p = pendientes.get(key) ?? { municipio: ica.municipio, periodicidad: ica.periodicidad, empresas: 0 };
    p.empresas++;
    pendientes.set(key, p);
  }

  const fecha = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("es-CO");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Calendario ICA</h1>
          <p className="text-sm text-slate-500">
            El ICA es municipal: carga aquí el calendario de cada municipio donde tienen domicilio tus
            empresas. Solo tu despacho ve estas fechas.
          </p>
        </div>
        <Link
          href="/calendario-ica/nuevo"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Cargar calendario ICA
        </Link>
      </div>

      {pendientes.size > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="mb-2 font-semibold">Municipios de tus empresas sin calendario {year}:</p>
          <div className="flex flex-wrap gap-2">
            {[...pendientes.values()].map((p) => (
              <Link
                key={`${p.municipio}-${p.periodicidad}`}
                href={`/calendario-ica/nuevo?municipio=${encodeURIComponent(p.municipio)}&periodicidad=${p.periodicidad}&year=${year}`}
                className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium hover:bg-amber-100"
              >
                {p.municipio} · {p.periodicidad} · {p.empresas} empresa{p.empresas === 1 ? "" : "s"} → cargar
              </Link>
            ))}
          </div>
          <p className="mt-2 text-xs">Mientras no lo cargues, esas empresas usan la regla manual de su ficha.</p>
        </div>
      )}

      {list.length === 0 ? (
        <p className="text-sm text-slate-500">Todavía no has cargado ningún calendario de ICA.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2">Municipio</th>
                <th className="px-4 py-2">Año</th>
                <th className="px-4 py-2">Periodicidad</th>
                <th className="px-4 py-2">Fechas</th>
                <th className="px-4 py-2">Vencimientos</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {list.map((g) => (
                <tr key={`${g.municipio}-${g.year}-${g.periodicidad}`} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-900">
                    {g.municipio}
                    {g.archivo && <span className="block text-xs font-normal text-slate-400">{g.archivo}</span>}
                  </td>
                  <td className="px-4 py-2">{g.year}</td>
                  <td className="px-4 py-2 capitalize">{g.periodicidad}</td>
                  <td className="px-4 py-2">
                    {g.fechas}
                    {g.porDigito ? " (por dígito del NIT)" : ""}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {fecha(g.primera)} a {fecha(g.ultima)}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <Link
                      href={`/calendario-ica/nuevo?municipio=${encodeURIComponent(g.municipio)}&periodicidad=${g.periodicidad}&year=${g.year}`}
                      className="mr-3 text-xs font-medium text-blue-600 hover:underline"
                    >
                      Editar
                    </Link>
                    <DeleteIcaCalendarButton municipio={g.municipio} year={g.year} periodicidad={g.periodicidad} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
