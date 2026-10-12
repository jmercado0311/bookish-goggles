import { NextResponse } from "next/server";
import { requirePlatformOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText, whatsappConfigured } from "@/lib/sales/whatsapp";

// POST: acciones del dueño sobre conversaciones y prospectos
//  { contact_id, body }                 -> responder como persona por WhatsApp
//  { contact_id, handed_off: boolean }  -> tomar la conversación o devolverla al asistente
//  { lead_id, estado }                  -> actualizar el estado del prospecto
export async function POST(request: Request) {
  await requirePlatformOwner();
  const admin = createAdminClient();
  const b = await request.json().catch(() => ({}));

  if (b.lead_id && ["nuevo", "contactado", "en_prueba", "ganado", "perdido"].includes(b.estado)) {
    const { error } = await admin.from("sales_leads").update({ estado: b.estado, updated_at: new Date().toISOString() }).eq("id", b.lead_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (!b.contact_id) return NextResponse.json({ error: "Falta el contacto." }, { status: 400 });
  const { data: contact } = await admin.from("whatsapp_contacts").select("*").eq("id", b.contact_id).maybeSingle();
  if (!contact) return NextResponse.json({ error: "Contacto no encontrado." }, { status: 404 });

  if (typeof b.handed_off === "boolean") {
    await admin.from("whatsapp_contacts").update({ handed_off: b.handed_off }).eq("id", contact.id);
    return NextResponse.json({ ok: true });
  }

  const text = String(b.body ?? "").trim();
  if (!text) return NextResponse.json({ error: "Escribe el mensaje." }, { status: 400 });
  if (!whatsappConfigured()) return NextResponse.json({ error: "WhatsApp no está configurado." }, { status: 503 });
  if (contact.opted_out) return NextResponse.json({ error: "El contacto pidió no recibir mensajes." }, { status: 400 });
  // Fuera de 24 horas desde el último mensaje del cliente, WhatsApp solo permite plantillas aprobadas
  if (Date.now() - new Date(contact.last_message_at).getTime() > 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "Pasaron más de 24 horas desde su último mensaje: WhatsApp solo permite plantillas aprobadas." }, { status: 400 });
  }
  const id = await sendWhatsAppText(contact.wa_id, text);
  if (!id) return NextResponse.json({ error: "WhatsApp rechazó el mensaje." }, { status: 502 });
  await admin.from("whatsapp_messages").insert({ contact_id: contact.id, direction: "out", body: text, wa_message_id: id, sent_by: "humano" });
  await admin.from("whatsapp_contacts").update({ handed_off: true }).eq("id", contact.id);
  return NextResponse.json({ ok: true });
}
