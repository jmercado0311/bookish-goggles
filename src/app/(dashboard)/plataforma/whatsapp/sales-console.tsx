"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface Lead {
  id: string;
  contact_id: string | null;
  nombre: string | null;
  despacho: string | null;
  ciudad: string | null;
  email: string | null;
  num_empresas: number | null;
  ejerce_revisoria: boolean | null;
  intereses: string[];
  notas: string | null;
  estado: string;
  updated_at: string;
}
export interface Contact {
  id: string;
  wa_id: string;
  nombre: string | null;
  opted_out: boolean;
  handed_off: boolean;
  last_message_at: string;
}
export interface Message {
  contact_id: string;
  direction: "in" | "out";
  body: string;
  sent_by: "cliente" | "asistente" | "humano";
  created_at: string;
}

type Turn = { role: "user" | "assistant"; content: string; note?: string };

const ESTADOS = ["nuevo", "contactado", "en_prueba", "ganado", "perdido"];
const fecha = (iso: string) => new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });

/** Burbujas tipo WhatsApp; *negrita* se muestra en negrita. */
function Bubble({ mine, text, meta }: { mine: boolean; text: string; meta?: string }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm shadow-sm ${mine ? "bg-emerald-100 text-slate-900" : "bg-white text-slate-900"}`}>
        {text.split(/(\*[^*]+\*)/g).map((part, i) =>
          /^\*[^*]+\*$/.test(part) ? <b key={i}>{part.slice(1, -1)}</b> : <span key={i}>{part}</span>
        )}
        {meta && <span className="mt-1 block text-[10px] text-slate-500">{meta}</span>}
      </div>
    </div>
  );
}

function Simulator() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const next: Turn[] = [...turns, { role: "user", content: text.trim() }];
    setTurns(next);
    setText("");
    setBusy(true);
    setError(null);
    const res = await fetch("/api/sales/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history: next.map(({ role, content }) => ({ role, content })) }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo responder.");
      return;
    }
    const notes = (data.actions ?? []).map((a: { type: string; data: Record<string, unknown> }) =>
      a.type === "lead" ? `Registraría al interesado: ${String(a.data.nombre ?? "")} · ${String(a.data.notas ?? "")}` : `Te pasaría la conversación: ${String(a.data.motivo ?? "")}`
    );
    setTurns([...next, { role: "assistant", content: data.reply, note: notes.join(" | ") || undefined }]);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Simulador (pruébalo como si fueras un cliente)</h2>
        {turns.length > 0 && (
          <button onClick={() => setTurns([])} className="text-xs text-slate-500 hover:underline">
            Nueva conversación
          </button>
        )}
      </div>
      <div className="h-96 space-y-2 overflow-y-auto rounded-xl bg-[#efeae2] p-3">
        {turns.length === 0 && (
          <p className="text-center text-xs text-slate-500">
            Escribe como lo haría un contador: &quot;Hola, ¿qué es Contaryx?&quot;, &quot;¿cuánto cuesta?&quot;, &quot;ya uso Siigo&quot;…
          </p>
        )}
        {turns.map((t, i) => (
          <div key={i}>
            <Bubble mine={t.role === "user"} text={t.content} />
            {t.note && <p className="mt-1 text-center text-[11px] text-violet-700">{t.note}</p>}
          </div>
        ))}
        {busy && <p className="text-xs text-slate-500">El asistente está escribiendo…</p>}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <form onSubmit={send} className="mt-2 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Mensaje del cliente…" className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm" />
        <button disabled={busy} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          Enviar
        </button>
      </form>
    </section>
  );
}

export function SalesConsole({ leads, contacts, messages }: { leads: Lead[]; contacts: Contact[]; messages: Message[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(contacts[0]?.id ?? null);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const contact = contacts.find((c) => c.id === selected);
  const thread = messages.filter((m) => m.contact_id === selected);

  async function post(body: object) {
    setError(null);
    const res = await fetch("/api/sales/reply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo completar.");
      return false;
    }
    router.refresh();
    return true;
  }

  return (
    <div className="space-y-6">
      <Simulator />

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Interesados ({leads.length})</h2>
        {leads.length === 0 ? (
          <p className="text-sm text-slate-500">Aún no hay interesados registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-1 pr-2">Nombre / despacho</th>
                  <th className="py-1 pr-2">Empresas</th>
                  <th className="py-1 pr-2">Intereses</th>
                  <th className="py-1 pr-2">Notas</th>
                  <th className="py-1 pr-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-t border-slate-100 align-top">
                    <td className="py-1.5 pr-2">
                      <b>{l.nombre}</b>
                      <span className="block text-slate-500">{[l.despacho, l.ciudad, l.email].filter(Boolean).join(" · ")}</span>
                    </td>
                    <td className="py-1.5 pr-2">{l.num_empresas ?? ""}{l.ejerce_revisoria ? " · RF" : ""}</td>
                    <td className="py-1.5 pr-2">{l.intereses.join(", ")}</td>
                    <td className="py-1.5 pr-2 text-slate-600">{l.notas}</td>
                    <td className="py-1.5 pr-2">
                      <select value={l.estado} onChange={(e) => post({ lead_id: l.id, estado: e.target.value })} className="rounded border border-slate-200 px-1 py-0.5">
                        {ESTADOS.map((e) => (
                          <option key={e} value={e}>{e.replace("_", " ")}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <div className="md:col-span-1">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Conversaciones</h2>
          {contacts.length === 0 && <p className="text-sm text-slate-500">Llegarán cuando conectes el número.</p>}
          <ul className="space-y-1">
            {contacts.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setSelected(c.id)}
                  className={`w-full rounded-lg px-2 py-1.5 text-left text-sm ${c.id === selected ? "bg-blue-50 text-blue-800" : "hover:bg-slate-50"}`}
                >
                  {c.nombre || `+${c.wa_id}`}
                  <span className="block text-[11px] text-slate-500">
                    {fecha(c.last_message_at)}
                    {c.handed_off && " · contigo"}
                    {c.opted_out && " · pidió baja"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="md:col-span-2">
          {contact && (
            <>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-800">{contact.nombre} · +{contact.wa_id}</span>
                <button onClick={() => post({ contact_id: contact.id, handed_off: !contact.handed_off })} className="rounded-lg border border-slate-300 px-2 py-1">
                  {contact.handed_off ? "Devolver al asistente" : "Tomar la conversación"}
                </button>
              </div>
              <div className="h-80 space-y-2 overflow-y-auto rounded-xl bg-[#efeae2] p-3">
                {thread.map((m, i) => (
                  <Bubble key={i} mine={m.direction === "out"} text={m.body} meta={`${m.sent_by} · ${fecha(m.created_at)}`} />
                ))}
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await post({ contact_id: contact.id, body: reply })) setReply("");
                }}
                className="mt-2 flex gap-2"
              >
                <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Responder como Johan…" className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm" />
                <button className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white">Enviar</button>
              </form>
            </>
          )}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      </section>
    </div>
  );
}
