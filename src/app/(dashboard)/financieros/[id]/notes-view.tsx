"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Note } from "@/lib/financial/notes";
import { ReportHeader, fechaLarga, money, type ReportInfo } from "./report-header";
import { PrintButton } from "./report-toolbar";

function NoteBlock({ note, trialBalanceId, canEdit }: { note: Note; trialBalanceId: string; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.text);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(content: string) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/financial/trial-balances/${trialBalanceId}/notes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note_key: note.key, content }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo guardar.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="break-inside-avoid border-b border-slate-100 py-4 last:border-0">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">
          Nota {note.number}. {note.title}
        </h3>
        {canEdit && !editing && (
          <div className="flex gap-2 print:hidden">
            {note.edited && (
              <button
                onClick={() => save("")}
                className="text-xs text-slate-500 hover:underline"
                title="Descartar la edición y volver al texto generado"
              >
                Restaurar
              </button>
            )}
            <button onClick={() => setEditing(true)} className="text-xs font-medium text-blue-600 hover:underline">
              Editar
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="print:hidden">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={Math.min(20, Math.max(5, text.split("\n").length + 2))}
            className="w-full rounded-lg border border-slate-300 p-3 text-sm"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => save(text)}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button
              onClick={() => {
                setText(note.text);
                setEditing(false);
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-sm leading-relaxed text-slate-700">
          {note.text.split(/\n{2,}/).map((p, i) => (
            <p key={i} className="whitespace-pre-line text-justify">
              {p}
            </p>
          ))}
        </div>
      )}

      {note.detail && note.detail.length > 0 && (
        <table className="mt-3 w-full text-xs">
          <thead>
            <tr className="border-b border-slate-300 text-slate-500">
              <th className="py-1 text-left font-medium">Cuenta</th>
              <th className="py-1 text-right font-medium">Actual</th>
              <th className="py-1 text-right font-medium">Anterior</th>
              <th className="py-1 text-right font-medium">Variación</th>
            </tr>
          </thead>
          <tbody>
            {note.detail.map((d) => (
              <tr key={d.code} className="text-slate-700">
                <td className="py-0.5">
                  <span className="font-mono text-slate-400">{d.code}</span> {d.name}
                </td>
                <td className="py-0.5 text-right tabular-nums">{money(d.current)}</td>
                <td className="py-0.5 text-right tabular-nums">{money(d.previous)}</td>
                <td className="py-0.5 text-right tabular-nums">{money(d.current - d.previous)}</td>
              </tr>
            ))}
            <tr className="border-t border-slate-300 font-semibold text-slate-900">
              <td className="py-1">Total</td>
              <td className="py-1 text-right tabular-nums">{money(note.detail.reduce((s, d) => s + d.current, 0))}</td>
              <td className="py-1 text-right tabular-nums">{money(note.detail.reduce((s, d) => s + d.previous, 0))}</td>
              <td className="py-1 text-right tabular-nums">
                {money(note.detail.reduce((s, d) => s + d.current - d.previous, 0))}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

export function NotesView({
  trialBalanceId,
  info,
  notes,
  canEdit,
  signatures,
}: {
  trialBalanceId: string;
  info: ReportInfo;
  notes: Note[];
  canEdit: boolean;
  signatures: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <PrintButton />
        <p className="text-xs text-slate-500">
          Los textos entre [corchetes] son para completar. Lo que edites queda guardado y reemplaza el
          texto automático de esa nota.
        </p>
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 print:border-0 print:p-0">
        <ReportHeader
          info={info}
          title="Notas a los estados financieros"
          subtitle={`Por el periodo terminado el ${fechaLarga(info.periodEnd)}`}
        />
        {notes.map((n) => (
          <NoteBlock key={`${n.key}-${n.text.length}`} note={n} trialBalanceId={trialBalanceId} canEdit={canEdit} />
        ))}
        {signatures}
      </section>
    </div>
  );
}
