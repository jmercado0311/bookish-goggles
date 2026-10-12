import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * WhatsApp Business Cloud API (Meta). Variables:
 * - WHATSAPP_TOKEN: token de acceso permanente (usuario del sistema)
 * - WHATSAPP_PHONE_NUMBER_ID: ID del número en el administrador de WhatsApp
 * - WHATSAPP_APP_SECRET: secreto de la app de Meta (firma de los webhooks)
 * - WHATSAPP_VERIFY_TOKEN: texto que tú eliges para verificar el webhook
 * - WHATSAPP_GRAPH_VERSION: versión del Graph API (por defecto v22.0)
 */

export function whatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_APP_SECRET);
}

/** Verifica la cabecera X-Hub-Signature-256 contra el cuerpo crudo. */
export function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = header.slice(7);
  return expected.length === received.length && timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

/** Envía un mensaje de texto (dentro de la ventana de 24 horas desde el último mensaje del cliente). */
export async function sendWhatsAppText(to: string, body: string): Promise<string | null> {
  const version = process.env.WHATSAPP_GRAPH_VERSION || "v22.0";
  const res = await fetch(`https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: body.slice(0, 4000), preview_url: true } }),
  });
  if (!res.ok) {
    console.error("WhatsApp send failed", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = await res.json().catch(() => ({}));
  return data?.messages?.[0]?.id ?? null;
}

export const OPT_OUT = /^\s*(baja|stop|cancelar|no (me )?escrib|no me interesa(n)? (m[aá]s )?mensajes)/i;
