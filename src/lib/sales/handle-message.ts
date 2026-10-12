import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWeeklyDigestEmail } from "@/lib/email/send";
import type { ServiceModule } from "@/lib/types";
import { runSalesAssistant, type ChatTurn } from "./assistant";
import { OPT_OUT, sendWhatsAppText } from "./whatsapp";

/** Procesa un mensaje entrante de WhatsApp: guarda, responde con el asistente y avisa al dueño si hace falta. */
export async function handleIncomingMessage(msg: { waId: string; name: string | null; text: string; messageId: string; appUrl: string }) {
  const admin = createAdminClient();

  const { data: contact } = await admin
    .from("whatsapp_contacts")
    .upsert({ wa_id: msg.waId, nombre: msg.name, last_message_at: new Date().toISOString() }, { onConflict: "wa_id" })
    .select()
    .single();
  if (!contact) return;

  // Idempotencia: Meta puede reenviar el mismo mensaje
  const { error: dup } = await admin
    .from("whatsapp_messages")
    .insert({ contact_id: contact.id, direction: "in", body: msg.text.slice(0, 4000), wa_message_id: msg.messageId, sent_by: "cliente" });
  if (dup) return;

  const reply = async (body: string, sentBy: "asistente" | "humano" = "asistente") => {
    const id = await sendWhatsAppText(msg.waId, body);
    await admin.from("whatsapp_messages").insert({ contact_id: contact.id, direction: "out", body, wa_message_id: id, sent_by: sentBy });
  };

  if (OPT_OUT.test(msg.text)) {
    await admin.from("whatsapp_contacts").update({ opted_out: true }).eq("id", contact.id);
    await reply("Listo, no le enviaremos más mensajes. Si más adelante quiere conocer Contaryx, escríbanos cuando guste. ¡Que tenga un buen día!");
    return;
  }
  if (contact.opted_out) {
    // Volvió a escribir: se reactiva la conversación
    await admin.from("whatsapp_contacts").update({ opted_out: false }).eq("id", contact.id);
  }
  // Conversación en manos de una persona: el asistente no interviene, solo se avisa
  if (contact.handed_off) {
    await notifyOwner(`Nuevo mensaje de ${contact.nombre ?? msg.waId}`, `<p>${escapeHtml(msg.text)}</p><p>Responder en ${msg.appUrl}/plataforma/whatsapp</p>`);
    return;
  }

  const [{ data: history }, { data: modules }] = await Promise.all([
    admin.from("whatsapp_messages").select("direction, body").eq("contact_id", contact.id).order("created_at", { ascending: false }).limit(30),
    admin.from("service_modules").select("*").eq("active", true).order("sort_order"),
  ]);
  const turns: ChatTurn[] = mergeTurns(
    (history ?? []).reverse().map((m) => ({ role: m.direction === "in" ? "user" : "assistant", content: m.body }))
  );

  const result = await runSalesAssistant({
    history: turns,
    modules: (modules ?? []) as ServiceModule[],
    appUrl: msg.appUrl,
    contactId: contact.id,
    persist: true,
  });
  await reply(result.reply);

  const handoff = result.actions.find((a) => a.type === "handoff");
  if (handoff) {
    await admin.from("whatsapp_contacts").update({ handed_off: true }).eq("id", contact.id);
    await notifyOwner(
      `WhatsApp: ${contact.nombre ?? msg.waId} quiere hablar contigo`,
      `<p><b>Motivo:</b> ${escapeHtml(String(handoff.data.motivo ?? ""))}</p><p><b>Último mensaje:</b> ${escapeHtml(msg.text)}</p><p>Responder en ${msg.appUrl}/plataforma/whatsapp</p>`
    );
  } else if (result.actions.some((a) => a.type === "lead")) {
    const lead = result.actions.filter((a) => a.type === "lead").pop()!.data;
    await notifyOwner(
      `Nuevo interesado en Contaryx: ${String(lead.nombre ?? msg.waId)}`,
      `<p>${escapeHtml(String(lead.notas ?? ""))}</p><p>Ver en ${msg.appUrl}/plataforma/whatsapp</p>`
    );
  }
}

/** La API exige turnos alternados: se unen mensajes consecutivos del mismo lado. */
export function mergeTurns(turns: ChatTurn[]): ChatTurn[] {
  const out: ChatTurn[] = [];
  for (const t of turns) {
    const last = out[out.length - 1];
    if (last && last.role === t.role) last.content += `\n${t.content}`;
    else out.push({ ...t });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

async function notifyOwner(subject: string, html: string) {
  const to = process.env.SALES_NOTIFY_EMAIL || process.env.GMAIL_USER;
  if (!to) return;
  try {
    await sendWeeklyDigestEmail(to, subject, html);
  } catch (err) {
    console.error("No se pudo notificar al dueño", err);
  }
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
