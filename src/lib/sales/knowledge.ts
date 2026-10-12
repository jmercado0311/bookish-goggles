import type { ServiceModule } from "@/lib/types";
import { TRIAL_DAYS } from "@/lib/billing/modules";

/**
 * Lo que el asistente de ventas sabe de Contaryx. Es la única fuente de la
 * que puede afirmar algo: si una función no está aquí, no la promete.
 * Los precios salen de la tabla service_modules (los que el dueño fija en
 * el panel Plataforma), así que nunca quedan desactualizados.
 */

const MODULE_DETAILS: Record<string, string[]> = {
  vencimientos: [
    "Calendario DIAN del año cargado y mantenido por Contaryx; el despacho no tiene que transcribirlo.",
    "Cruce automático de cada empresa con su NIT (último dígito o dos últimos dígitos) y sus responsabilidades del RUT: renta, IVA bimestral o cuatrimestral, retención, INC, exógena, grandes contribuyentes.",
    "ICA por municipio: el despacho carga el calendario de cada municipio y una empresa puede declarar en varios municipios.",
    "Nómina electrónica, PILA y otras obligaciones con fechas propias.",
    "Semáforo de urgencia, marcar declaraciones como presentadas, exportar a Excel y PDF.",
    "Correo automático cada lunes a cada colaborador con lo vencido sin presentar, la semana día por día y las 4 semanas siguientes.",
  ],
  estados_financieros: [
    "Se sube el balance de prueba en Excel o CSV exportado de cualquier software (Siigo, World Office, Alegra, Helisa, ContaPyme…).",
    "Clasificación automática de cuentas PUC a rubros NIIF, editable.",
    "Juego completo según el grupo NIIF de cada empresa: Grupo 1 (NIIF plenas), Grupo 2 (NIIF para las PYMES) o Grupo 3 (microempresas), con los títulos y estados que exige cada marco.",
    "Estado de situación financiera, resultado integral, cambios en el patrimonio y flujo de efectivo método indirecto, comparativos.",
    "Verificación de cumplimiento normativo antes de emitir y certificación del art. 37 de la Ley 222 de 1995. Descarga en Excel y PDF.",
  ],
  notas: [
    "Notas a los estados financieros generadas desde el balance: entidad, bases de preparación, políticas contables según el grupo NIIF y una nota por rubro con detalle de cuentas y variaciones.",
    "Todos los textos son editables por el contador.",
  ],
  indicadores: [
    "Liquidez, endeudamiento, rentabilidad, actividad, EBITDA y ciclo de conversión del efectivo.",
    "Indicadores habilitantes para el RUP (contratación estatal).",
    "Interpretación automática en lenguaje claro, con semáforo favorable, atención o riesgo.",
  ],
  conciliaciones: [
    "Conciliación bancaria automática: el extracto de cualquier banco (Excel, CSV o PDF) contra el auxiliar de bancos de cualquier sistema contable.",
    "Reconoce la estructura de cada archivo sola y verifica que el saldo cuadre fila a fila.",
    "Empareja por valor, fecha cercana, número de cheque o documento, e incluso partidas agrupadas (una consignación contra varios recibos).",
    "Clasifica las partidas conciliatorias con la cuenta sugerida: GMF 4x1000, comisiones, intereses, retenciones, cheques pendientes y consignaciones en tránsito.",
    "Consulta de libros auxiliares por cuenta, tercero, texto y fechas.",
  ],
  revisoria: [
    "Solo para despachos que ejercen revisoría fiscal, y para las empresas obligadas a tenerla; Contaryx ayuda a identificar cuáles lo están (art. 203 C. de Co. y par. 2 del art. 13 de la Ley 43 de 1990).",
    "Materialidad (NIA 320), matriz de riesgos y papeles de trabajo propuestos según los saldos del balance.",
    "Señales de alerta automáticas del balance, registro de hallazgos y opinión sugerida (NIA 450 y 705).",
    "Borradores editables del dictamen (NIA 700, 705, 706), del informe del art. 209 del C. de Co. y de la carta de representación (NIA 580).",
  ],
};

const fmt = (n: number) => `$${n.toLocaleString("es-CO")}`;

export function buildProductKnowledge(modules: ServiceModule[], appUrl: string): string {
  const lines: string[] = [];
  for (const m of modules.filter((x) => x.active)) {
    lines.push(`## ${m.name} — ${fmt(m.price_cop)} al mes (IVA incluido)`);
    lines.push(m.description);
    for (const d of MODULE_DETAILS[m.code] ?? []) lines.push(`- ${d}`);
    lines.push("");
  }
  return `# Contaryx
Plataforma web para contadores y despachos contables en Colombia. Funciona en el navegador y se instala como app en el celular o el computador. Creada por Johan Mercado Frías, contador público, especialista en Revisoría Fiscal y Auditoría Forense.

## Condiciones comerciales
- Prueba gratis de ${TRIAL_DAYS} días, sin tarjeta de crédito. Registro: ${appUrl}/registro
- Se paga por módulo y por despacho, no por empresa ni por usuario: usuarios y empresas ilimitados.
- Descuento del 10 % pagando 6 meses y del 20 % pagando 12 meses.
- Pagos con Wompi (Bancolombia): PSE, Nequi, tarjeta débito o crédito.
- Cada despacho ve solo su información; los colaboradores ven solo las empresas que el administrador les asigna.

# Módulos
${lines.join("\n")}
# Lo que Contaryx NO hace (no lo prometas)
- No presenta declaraciones ante la DIAN ni paga impuestos: recuerda y organiza los vencimientos.
- No reemplaza el software contable: lee sus reportes (balance de prueba, auxiliares).
- No firma ni asume la responsabilidad profesional: el contador y el revisor fiscal revisan y firman.
- No tiene integración directa con bancos ni con la DIAN: se trabaja con archivos que el usuario descarga.
- No hay aplicación en tiendas (App Store/Play Store): se instala desde el navegador.`;
}
