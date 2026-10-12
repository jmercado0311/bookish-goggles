import Link from "next/link";
import { requirePlatformOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { whatsappConfigured } from "@/lib/sales/whatsapp";
import { aiConfigured } from "@/lib/ledger/ai";
import { SalesConsole, type Contact, type Lead, type Message } from "./sales-console";

export default async function WhatsAppPage() {
  await requirePlatformOwner();
  const admin = createAdminClient();
  const [{ data: leads }, { data: contacts }, { data: messages }] = await Promise.all([
    admin.from("sales_leads").select("*").order("updated_at", { ascending: false }).limit(200),
    admin.from("whatsapp_contacts").select("*").order("last_message_at", { ascending: false }).limit(50),
    admin.from("whatsapp_messages").select("contact_id, direction, body, sent_by, created_at").order("created_at", { ascending: false }).limit(1000),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/plataforma" className="text-xs text-blue-600 hover:underline">
          ← Plataforma
        </Link>
        <h1 className="text-lg font-semibold text-slate-900">Asistente de ventas por WhatsApp</h1>
        <p className="text-sm text-slate-500">
          Responde a posibles clientes, muestra lo que hace Contaryx según su necesidad, registra a los
          interesados y te pasa la conversación cuando piden hablar con una persona.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className={`rounded-full px-2.5 py-1 font-medium ${aiConfigured() ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
          IA: {aiConfigured() ? "configurada" : "falta ANTHROPIC_API_KEY"}
        </span>
        <span className={`rounded-full px-2.5 py-1 font-medium ${whatsappConfigured() ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
          WhatsApp: {whatsappConfigured() ? "conectado" : "sin número todavía (usa el simulador)"}
        </span>
      </div>
      <SalesConsole
        leads={(leads ?? []) as Lead[]}
        contacts={(contacts ?? []) as Contact[]}
        messages={((messages ?? []) as Message[]).reverse()}
      />
    </div>
  );
}
