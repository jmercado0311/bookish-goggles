import Link from "next/link";

export const metadata = { title: "Términos y tratamiento de datos · Vencimientos Tributarios" };

// Plantilla base: el responsable debe completarla y revisarla con asesoría
// jurídica antes de vender (identificación, canales de atención, etc.).
export default function TerminosPage() {
  return (
    <div className="flex-1 bg-white">
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm leading-relaxed text-slate-700">
        <Link href="/" className="text-xs text-blue-600 hover:underline">
          ← Inicio
        </Link>
        <h1 className="mb-6 mt-2 text-xl font-semibold text-slate-900">
          Términos de uso y política de tratamiento de datos personales
        </h1>

        <h2 className="mb-2 mt-6 font-semibold text-slate-900">1. Responsable del tratamiento</h2>
        <p>
          Johan Mercado Frías, contador público, [cédula / NIT], domicilio [ciudad], correo de contacto
          [correo], es el responsable del tratamiento de los datos personales recolectados a través de
          esta plataforma, en los términos de la Ley 1581 de 2012 y el Decreto 1377 de 2013 (compilado en
          el Decreto 1074 de 2015).
        </p>

        <h2 className="mb-2 mt-6 font-semibold text-slate-900">2. Datos que se recolectan y finalidad</h2>
        <p>
          Se recolectan nombre, correo electrónico, nombre e identificación del despacho, y la información
          de las empresas y balances de prueba que el usuario carga. La finalidad es prestar el servicio
          contratado (cálculo de vencimientos, generación de estados financieros, notas e indicadores),
          enviar notificaciones del servicio, facturar y atender solicitudes. La información contable de
          las empresas es del usuario y no se usa para fines distintos a prestarle el servicio.
        </p>

        <h2 className="mb-2 mt-6 font-semibold text-slate-900">3. Derechos del titular</h2>
        <p>
          El titular puede conocer, actualizar, rectificar y suprimir sus datos, revocar la autorización y
          presentar quejas ante la Superintendencia de Industria y Comercio, escribiendo al correo de
          contacto indicado arriba. Las consultas se atienden en máximo diez (10) días hábiles y los
          reclamos en máximo quince (15) días hábiles.
        </p>

        <h2 className="mb-2 mt-6 font-semibold text-slate-900">4. Seguridad</h2>
        <p>
          Los datos se almacenan cifrados en tránsito, con control de acceso por despacho y por usuario.
          Cada despacho solo puede ver su propia información.
        </p>

        <h2 className="mb-2 mt-6 font-semibold text-slate-900">5. Alcance del servicio</h2>
        <p>
          La plataforma es una herramienta de apoyo para el contador. Los estados financieros, notas e
          indicadores se generan a partir de la información cargada por el usuario y deben ser revisados,
          ajustados y certificados por el contador público responsable, quien conserva la responsabilidad
          profesional sobre su contenido (Ley 43 de 1990). Las fechas de vencimiento se basan en el
          calendario tributario oficial; el usuario debe verificar cualquier cambio normativo.
        </p>

        <h2 className="mb-2 mt-6 font-semibold text-slate-900">6. Pagos y renovación</h2>
        <p>
          Los módulos se pagan por anticipado por el periodo elegido a través de Wompi. Al vencer el
          periodo, el módulo se desactiva hasta su renovación; la información se conserva. Los precios
          incluyen IVA.
        </p>
      </div>
    </div>
  );
}
