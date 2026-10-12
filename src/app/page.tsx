import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCop, TRIAL_DAYS } from "@/lib/billing/modules";
import type { ServiceModule } from "@/lib/types";

const FEATURES: Record<string, string[]> = {
  vencimientos: [
    "Calendario DIAN cargado y actualizado por nosotros",
    "Cruce automático por último dígito del NIT",
    "ICA, nómina electrónica y PILA",
    "Correo semanal a cada colaborador",
  ],
  estados_financieros: [
    "Importa el balance de prueba en Excel",
    "Clasificación automática PUC → NIIF",
    "Situación financiera, resultados, patrimonio y flujo de efectivo",
    "Descarga en Excel y PDF con firmas",
  ],
  notas: [
    "Entidad, bases de preparación y políticas contables",
    "Una nota por rubro con detalle y variaciones",
    "Grupo 1, 2 y 3 (Decreto 2420 de 2015)",
    "Textos editables por el contador",
  ],
  indicadores: [
    "Liquidez, endeudamiento, rentabilidad y actividad",
    "EBITDA y ciclo de conversión del efectivo",
    "Indicadores habilitantes para el RUP",
    "Interpretación automática y comparativa",
  ],
};

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/vencimientos");

  const { data: modules } = await supabase
    .from("service_modules")
    .select("*")
    .eq("active", true)
    .order("sort_order");

  return (
    <div className="flex flex-1 flex-col bg-white">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <p className="text-sm font-semibold text-slate-900">Vencimientos Tributarios</p>
          <div className="flex gap-2">
            <Link href="/login" className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Ingresar
            </Link>
            <Link href="/registro" className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
              Prueba gratis
            </Link>
          </div>
        </div>
      </header>

      <section className="bg-slate-50">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <h1 className="text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
            La plataforma del contador colombiano: vencimientos DIAN, estados financieros NIIF, notas e
            indicadores
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600">
            Controla los vencimientos de todas tus empresas y prepara sus estados financieros desde el
            balance de prueba en minutos. Activa solo los módulos que necesitas.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/registro" className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
              Probar {TRIAL_DAYS} días gratis
            </Link>
            <Link href="/login" className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Ya tengo cuenta
            </Link>
          </div>
          <p className="mt-3 text-xs text-slate-500">Sin tarjeta de crédito. Instálala en el celular o el computador como app.</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14">
        <h2 className="mb-2 text-center text-xl font-semibold text-slate-900">Módulos y precios</h2>
        <p className="mb-8 text-center text-sm text-slate-500">
          Precios mensuales por despacho, IVA incluido. Usuarios y empresas ilimitados. 10 % de descuento
          pagando 6 meses y 20 % pagando el año.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {((modules ?? []) as ServiceModule[]).map((m) => (
            <div key={m.code} className="flex flex-col rounded-2xl border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-900">{m.name}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {formatCop(m.price_cop)}
                <span className="text-xs font-normal text-slate-500"> / mes</span>
              </p>
              <p className="mt-2 text-sm text-slate-500">{m.description}</p>
              <ul className="mt-4 flex-1 space-y-1.5 text-sm text-slate-700">
                {(FEATURES[m.code] ?? []).map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          Pagos seguros con Wompi (Bancolombia): PSE, Nequi, tarjeta débito o crédito.
        </p>
      </section>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center text-xs leading-relaxed text-slate-500">
          <p className="font-semibold text-slate-700">Johan Mercado Frías · Contador público</p>
          <p>Especialista en Revisoría Fiscal y Auditoría Forense</p>
          <p className="mt-2">
            <Link href="/terminos" className="underline">
              Términos y política de tratamiento de datos
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
