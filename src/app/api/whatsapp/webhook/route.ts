import { NextResponse, after } from "next/server";
import { handleIncomingMessage } from "@/lib/sales/handle-message";
import { verifySignature, whatsappConfigured } from "@/lib/sales/whatsapp";

// GET: verificación del webhook al configurarlo en Meta
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Verificación fallida." }, { status: 403 });
}

interface WaMessage {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
  button?: { text: string };
  interactive?: { button_reply?: { title: string }; list_reply?: { title: string } };
}

// POST: mensajes entrantes. Se responde 200 de inmediato y se procesa después,
// para que Meta no reintente mientras el asistente redacta la respuesta.
export async function POST(request: Request) {
  if (!whatsappConfigured()) return NextResponse.json({ error: "WhatsApp no configurado." }, { status: 503 });
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Firma inválida." }, { status: 401 });
  }
  const payload = JSON.parse(raw);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const names = new Map<string, string>((value.contacts ?? []).map((c: { wa_id: string; profile?: { name?: string } }) => [c.wa_id, c.profile?.name ?? ""]));
      for (const m of (value.messages ?? []) as WaMessage[]) {
        const text =
          m.text?.body ??
          m.button?.text ??
          m.interactive?.button_reply?.title ??
          m.interactive?.list_reply?.title ??
          "[El cliente envió un archivo, audio o imagen que el asistente no puede ver. Pídele amablemente que escriba su consulta.]";
        after(() =>
          handleIncomingMessage({ waId: m.from, name: names.get(m.from) || null, text, messageId: m.id, appUrl }).catch((err) =>
            console.error("Error procesando mensaje de WhatsApp", err)
          )
        );
      }
    }
  }
  return NextResponse.json({ ok: true });
}
