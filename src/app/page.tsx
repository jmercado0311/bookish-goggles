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
    "Juego completo según el grupo NIIF (1, 2 o 3) de cada empresa",
    "Importa el balance de prueba en Excel y lo clasifica de PUC a NIIF",
    "Verificación de cumplimiento normativo antes de emitir",
    "Certificación (art. 37 Ley 222) y descarga en Excel y PDF",
  ],
  notas: [
    "Entidad, bases de preparación y políticas contables",
    "Una nota por rubro con detalle y variaciones",
    "Referencias de NIC/NIIF o Secciones PYMES según el grupo",
    "Textos editables por el contador",
  ],
  indicadores: [
    "Liquidez, endeudamiento, rentabilidad y actividad",
    "EBITDA y ciclo de conversión del efectivo",
    "Indicadores habilitantes para el RUP",
    "Interpretación automática y comparativa",
  ],
  conciliaciones: [
    "Extractos de cualquier banco en Excel, CSV o PDF",
    "Auxiliares de cualquier sistema contable",
    "Emparejamiento automático, también de partidas agrupadas",
    "GMF, comisiones e intereses con cuenta sugerida",
  ],
  revisoria: [
    "Materialidad (NIA 320) y matriz de riesgos",
    "Papeles de trabajo por área con procedimientos NIA",
    "Hallazgos y opinión sugerida (NIA 450 / 705)",
    "Dictamen, informe art. 209 y carta de representación",
  ],
};

function ModuleCard({ m }: { m: ServiceModule }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5">
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
  );
}

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

  const all = (modules ?? []) as ServiceModule[];

  return (
    <div className="flex flex-1 flex-col bg-white">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <p className="text-lg font-bold tracking-tight text-slate-900">Contaryx</p>
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

      <section className="mx-auto w-full max-w-4xl px-4 pt-14">
        <h2 className="mb-2 text-center text-xl font-semibold text-slate-900">Mira cómo funciona</h2>
        <p className="mb-6 text-center text-sm text-slate-500">
          Menos riesgo de sanciones y estados financieros conforme al grupo NIIF de cada empresa.
        </p>
        <video
          controls
          preload="metadata"
          poster="/video/contaryx-demo-poster.jpg"
          className="w-full rounded-2xl border border-slate-200 shadow-sm"
        >
          <source src="/video/contaryx-demo.mp4" type="video/mp4" />
        </video>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14">
        <h2 className="mb-2 text-center text-xl font-semibold text-slate-900">Módulos y precios</h2>
        <p className="mb-8 text-center text-sm text-slate-500">
          Precios mensuales por despacho, IVA incluido. Usuarios y empresas ilimitados. 10 % de descuento
          pagando 6 meses y 20 % pagando el año.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {all.filter((m) => m.code !== "revisoria").map((m) => (
            <ModuleCard key={m.code} m={m} />
          ))}
        </div>
        {all.some((m) => m.code === "revisoria") && (
          <div className="mt-10 rounded-3xl bg-slate-900 p-6 text-white sm:p-8">
            <div className="grid items-center gap-6 md:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-amber-400">¿Ejerces revisoría fiscal?</p>
                <h3 className="mt-2 text-2xl font-bold">Complemento para revisores fiscales</h3>
                <p className="mt-2 text-sm text-slate-300">
                  Solo para despachos que ejercen revisoría fiscal y para las empresas obligadas a tenerla (art. 203
                  C. de Co. y par. 2 del art. 13 de la Ley 43 de 1990). Contaryx te ayuda a identificar cuáles son.
                </p>
              </div>
              <div className="text-slate-900">
                {all.filter((m) => m.code === "revisoria").map((m) => (
                  <ModuleCard key={m.code} m={m} />
                ))}
              </div>
            </div>
          </div>
        )}
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
