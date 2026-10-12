import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ServiceModule } from "@/lib/types";
import { buildProductKnowledge } from "./knowledge";

/**
 * Asistente de ventas de Contaryx (WhatsApp y simulador del panel).
 *
 * Su objetivo es convertir prospectos en pruebas gratis: entiende la
 * necesidad del contador, muestra el módulo que la resuelve con ejemplos
 * concretos, responde objeciones con hechos y cierra con un paso claro. Es
 * persuasivo pero honesto: se presenta como asistente virtual, no inventa
 * funciones, precios, clientes ni testimonios, y pasa a una persona cuando
 * se lo piden o cuando no sabe.
 */

const MODEL = "claude-opus-5-5";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export interface AssistantAction {
  type: "lead" | "handoff";
  data: Record<string, unknown>;
}

const SALES_RULES = `Eres el asistente virtual de ventas de Contaryx por WhatsApp. Hablas con contadores, despachos contables y revisores fiscales de Colombia que escribieron interesados.

# Tu objetivo
Que la persona active la prueba gratis (o hable con Johan si lo prefiere). Para eso:
1. Saluda breve, preséntate como asistente virtual de Contaryx y pregunta en qué la puedes ayudar.
2. Descubre su situación con una o dos preguntas a la vez: ¿cuántas empresas lleva?, ¿qué le quita más tiempo o le preocupa (vencimientos, cierres, conciliaciones, revisoría)?, ¿trabaja solo o con equipo?, ¿ejerce revisoría fiscal?
3. Conecta su dolor con el módulo que lo resuelve y muéstralo con un ejemplo concreto de su día a día (por ejemplo: "con 30 empresas, el lunes le llega a cada auxiliar lo que vence en la semana").
4. Cuantifica el beneficio cuando ayude: horas ahorradas, sanciones evitadas (la sanción por extemporaneidad es el 5 % del impuesto por cada mes o fracción, art. 641 E.T.), riesgo profesional reducido. Sin inventar cifras de clientes.
5. Cierra con un paso claro: el enlace de la prueba gratis, o pasar con Johan.

# Objeciones frecuentes
- "Es caro": se paga por despacho y por módulo, con empresas y usuarios ilimitados; se puede empezar solo con lo que necesita; la prueba es gratis y sin tarjeta; una sola sanción evitada suele pagar meses de servicio.
- "Ya uso Siigo/World Office/Alegra": Contaryx no lo reemplaza, lo complementa: lee sus reportes y hace lo que esos programas no hacen (control de vencimientos de toda la cartera, estados NIIF por grupo con notas, conciliaciones automáticas, revisoría).
- "¿Mis datos están seguros?": cada despacho ve solo su información, los colaboradores solo las empresas asignadas, y se cumple la Ley 1581 de 2012.
- "No tengo tiempo de aprender otra herramienta": se sube el archivo tal como sale del software contable y la app hace el resto; la prueba dura 14 días.
- "¿Sirve para revisoría fiscal?": sí, con el complemento de revisoría, si la ejerce.

# Estilo WhatsApp
- Español colombiano, cercano y profesional. Trato de "usted" salvo que la persona tutee.
- Mensajes cortos: 2 a 5 líneas. Máximo un emoji ocasional. Listas cortas solo si ayudan. Sin títulos ni markdown pesado (WhatsApp solo admite *negrita*).
- Una pregunta a la vez. No repitas todo el catálogo: muestra lo relevante para esa persona.

# Reglas que no puedes romper
- Solo afirma lo que está en la información del producto. Si no sabes algo, dilo y ofrece pasar con Johan.
- No inventes clientes, testimonios, cifras de usuarios, descuentos ni promociones. Los precios son los de la información del producto.
- No presiones con urgencia falsa ni insistas si la persona no está interesada; agradece y despídete.
- No des asesoría tributaria o contable puntual sobre casos del cliente: puedes citar la norma general, pero el caso concreto lo atiende un contador.
- Si la persona pide hablar con una persona, quiere una demostración, pregunta por planes especiales o factura, o se molesta: usa la herramienta transferir_a_humano y dile que Johan le escribirá pronto.
- Cuando conozcas al menos su nombre y su necesidad, registra al interesado con la herramienta registrar_interesado (actualízalo si aprendes más). No pidas datos que no necesitas.
- Si la persona escribe BAJA o pide no recibir más mensajes, despídete con respeto.`;

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "registrar_interesado",
    description:
      "Guarda o actualiza los datos del prospecto en el CRM cuando ya conoces su nombre y su necesidad. Úsala de nuevo si aprendes más datos.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string" },
        despacho: { type: ["string", "null"], description: "Nombre del despacho o firma, si lo dijo" },
        ciudad: { type: ["string", "null"] },
        email: { type: ["string", "null"] },
        num_empresas: { type: ["integer", "null"], description: "Cuántas empresas lleva, si lo dijo" },
        ejerce_revisoria: { type: ["boolean", "null"] },
        intereses: {
          type: "array",
          items: { type: "string", enum: ["vencimientos", "estados_financieros", "notas", "indicadores", "conciliaciones", "revisoria"] },
        },
        notas: { type: "string", description: "Necesidades, objeciones y siguiente paso, en una o dos frases" },
      },
      required: ["nombre", "despacho", "ciudad", "email", "num_empresas", "ejerce_revisoria", "intereses", "notas"],
      additionalProperties: false,
    },
  },
  {
    name: "transferir_a_humano",
    description:
      "Pasa la conversación a Johan (persona). Úsala si el cliente lo pide, quiere una demostración, pregunta algo que no está en la información del producto o está molesto.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { motivo: { type: "string" } },
      required: ["motivo"],
      additionalProperties: false,
    },
  },
];

export async function runSalesAssistant(params: {
  history: ChatTurn[];
  modules: ServiceModule[];
  appUrl: string;
  contactId: string | null;
  /** En el simulador no se guarda nada: solo se informan las acciones. */
  persist: boolean;
}): Promise<{ reply: string; actions: AssistantAction[] }> {
  const client = new Anthropic();
  const actions: AssistantAction[] = [];
  const messages: Anthropic.Beta.BetaMessageParam[] = params.history.slice(-30).map((t) => ({ role: t.role, content: t.content }));

  // El conocimiento del producto y las reglas no cambian entre mensajes: se cachean
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: SALES_RULES },
    { type: "text", text: buildProductKnowledge(params.modules, params.appUrl), cache_control: { type: "ephemeral" } },
  ];

  for (let i = 0; i < 4; i++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system,
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason === "refusal") {
      return { reply: "Gracias por escribirnos. Le pido a Johan que le responda personalmente en breve.", actions: [{ type: "handoff", data: { motivo: "La IA no respondió" } }] };
    }

    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (toolUses.length === 0) {
      const text = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { reply: text || "¿En qué más le puedo ayudar?", actions };
    }

    messages.push({ role: "assistant", content: response.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const tool of toolUses) {
      const input = tool.input as Record<string, unknown>;
      if (tool.name === "registrar_interesado") {
        actions.push({ type: "lead", data: input });
        if (params.persist) await saveLead(params.contactId, input);
        results.push({ type: "tool_result", tool_use_id: tool.id, content: "Interesado registrado." });
      } else if (tool.name === "transferir_a_humano") {
        actions.push({ type: "handoff", data: input });
        results.push({ type: "tool_result", tool_use_id: tool.id, content: "Transferido: Johan continuará la conversación. Despídete brevemente indicando que él escribirá pronto." });
      } else {
        results.push({ type: "tool_result", tool_use_id: tool.id, content: "Herramienta desconocida.", is_error: true });
      }
    }
    messages.push({ role: "user", content: results });
  }
  return { reply: "Gracias por su interés. En un momento le confirmo.", actions };
}

async function saveLead(contactId: string | null, data: Record<string, unknown>) {
  const admin = createAdminClient();
  const row = {
    contact_id: contactId,
    nombre: data.nombre ? String(data.nombre).slice(0, 120) : null,
    despacho: data.despacho ? String(data.despacho).slice(0, 160) : null,
    ciudad: data.ciudad ? String(data.ciudad).slice(0, 80) : null,
    email: data.email ? String(data.email).slice(0, 160) : null,
    num_empresas: Number.isInteger(data.num_empresas) ? data.num_empresas : null,
    ejerce_revisoria: typeof data.ejerce_revisoria === "boolean" ? data.ejerce_revisoria : null,
    intereses: Array.isArray(data.intereses) ? data.intereses.map(String).slice(0, 6) : [],
    notas: data.notas ? String(data.notas).slice(0, 1000) : null,
    updated_at: new Date().toISOString(),
  };
  // Un prospecto por contacto de WhatsApp: se actualiza a medida que se aprende más
  const { data: existing } = contactId
    ? await admin.from("sales_leads").select("id").eq("contact_id", contactId).maybeSingle()
    : { data: null };
  if (existing) await admin.from("sales_leads").update(row).eq("id", existing.id);
  else await admin.from("sales_leads").insert(row);
}
