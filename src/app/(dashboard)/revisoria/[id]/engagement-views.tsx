"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { computeMateriality, MATERIALITY_BASES, type MaterialityBase } from "@/lib/audit/planning";
import { OPINION_LABEL, type DocSection, type Opinion } from "@/lib/audit/report";

const money = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;
const input = "w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm";

export interface Risk {
  id: string;
  area: string;
  afirmacion: string;
  descripcion: string;
  riesgo_inherente: "alto" | "medio" | "bajo";
  riesgo_control: "alto" | "medio" | "bajo";
  significativo: boolean;
  respuesta: string;
}

export interface Workpaper {
  id: string;
  ref: string;
  area: string;
  titulo: string;
  objetivo: string;
  procedimientos: string;
  resultado: string;
  conclusion: string;
  estado: "pendiente" | "en_proceso" | "terminado";
  preparado_por: string | null;
  revisado_por: string | null;
  fecha_preparacion: string | null;
  fecha_revision: string | null;
}

export interface Finding {
  id: string;
  workpaper_ref: string | null;
  titulo: string;
  condicion: string;
  criterio: string;
  causa: string;
  efecto: string;
  recomendacion: string;
  monto: number;
  tipo: "incorreccion" | "control_interno" | "incumplimiento_legal" | "otro";
  corregido: boolean;
}

function useApi() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function call(url: string, method: string, body: object) {
    setBusy(true);
    setError(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo guardar.");
      return false;
    }
    router.refresh();
    return true;
  }
  return { busy, error, call };
}

const item = (table: string, engagementId: string) => ({
  add: (data: object) => ({ url: "/api/audit/items", method: "POST", body: { table, engagement_id: engagementId, data } }),
  update: (id: string, data: object) => ({ url: "/api/audit/items", method: "PATCH", body: { table, id, data } }),
  remove: (id: string) => ({ url: "/api/audit/items", method: "DELETE", body: { table, id } }),
});

// ---------------------------------------------------------------------------
// Planeación y materialidad
// ---------------------------------------------------------------------------

export function PlanningView({
  engagement,
  canEdit,
  baseAmounts,
  hasTrialBalance,
  flags,
  noCorregidas,
  sugerida,
}: {
  engagement: Record<string, unknown>;
  canEdit: boolean;
  baseAmounts: Record<MaterialityBase, number>;
  hasTrialBalance: boolean;
  flags: string[];
  noCorregidas: number;
  sugerida: Opinion;
}) {
  const { busy, error, call } = useApi();
  const [base, setBase] = useState(engagement.materialidad_base as MaterialityBase);
  const [porcentaje, setPorcentaje] = useState(String(engagement.materialidad_porcentaje));
  const [global, setGlobal] = useState(String(engagement.materialidad_global));
  const [ejecucion, setEjecucion] = useState(String(engagement.materialidad_ejecucion));
  const [trivial, setTrivial] = useState(String(engagement.umbral_trivial));
  const [revisor, setRevisor] = useState(String(engagement.revisor_nombre ?? ""));
  const [tp, setTp] = useState(String(engagement.revisor_tp ?? ""));
  const [firma, setFirma] = useState(String(engagement.firma_designante ?? ""));
  const [ciudad, setCiudad] = useState(String(engagement.ciudad ?? ""));
  const [fechaInforme, setFechaInforme] = useState(String(engagement.fecha_informe ?? ""));

  function recalc(b: MaterialityBase, pct: string) {
    if (!hasTrialBalance) return;
    const m = computeMateriality(baseAmounts[b], Number(pct.replace(",", ".")) || 0);
    setGlobal(String(m.global));
    setEjecucion(String(m.ejecucion));
    setTrivial(String(m.trivial));
  }

  const save = () =>
    call(`/api/audit/engagements/${engagement.id}`, "PATCH", {
      materialidad_base: base,
      materialidad_porcentaje: Number(porcentaje.replace(",", ".")),
      materialidad_global: Number(global),
      materialidad_ejecucion: Number(ejecucion),
      umbral_trivial: Number(trivial),
      revisor_nombre: revisor,
      revisor_tp: tp,
      firma_designante: firma,
      ciudad,
      fecha_informe: fechaInforme,
    });

  const superaMaterialidad = noCorregidas >= Number(engagement.materialidad_global) && Number(engagement.materialidad_global) > 0;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Materialidad (NIA 320)</h2>
        <p className="mb-4 text-xs text-slate-500">
          La materialidad de ejecución se propone en 75 % de la global y el umbral de incorrecciones claramente
          insignificantes en 5 %. Ajústalos según tu evaluación del riesgo del encargo.
        </p>
        <div className="grid gap-3 md:grid-cols-5">
          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-600">Base</span>
            <select
              value={base}
              disabled={!canEdit}
              onChange={(e) => {
                const b = e.target.value as MaterialityBase;
                setBase(b);
                setPorcentaje(String(MATERIALITY_BASES[b].porcentaje));
                recalc(b, String(MATERIALITY_BASES[b].porcentaje));
              }}
              className={input}
            >
              {(Object.keys(MATERIALITY_BASES) as MaterialityBase[]).map((b) => (
                <option key={b} value={b}>
                  {MATERIALITY_BASES[b].label} {hasTrialBalance ? `(${money(baseAmounts[b])})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-600">% ({MATERIALITY_BASES[base].rango})</span>
            <input value={porcentaje} disabled={!canEdit} onChange={(e) => { setPorcentaje(e.target.value); recalc(base, e.target.value); }} className={input} />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-600">Materialidad global</span>
            <input value={global} disabled={!canEdit} onChange={(e) => setGlobal(e.target.value)} className={input} />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-600">De ejecución</span>
            <input value={ejecucion} disabled={!canEdit} onChange={(e) => setEjecucion(e.target.value)} className={input} />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-600">Umbral trivial</span>
            <input value={trivial} disabled={!canEdit} onChange={(e) => setTrivial(e.target.value)} className={input} />
          </label>
        </div>
        <h3 className="mb-2 mt-5 text-xs font-semibold text-slate-700">Datos del revisor fiscal e informe</h3>
        <div className="grid gap-3 md:grid-cols-5">
          {[
            ["Revisor fiscal", revisor, setRevisor],
            ["Tarjeta profesional", tp, setTp],
            ["Firma que designa (si aplica)", firma, setFirma],
            ["Ciudad", ciudad, setCiudad],
          ].map(([label, value, setter]) => (
            <label key={label as string} className="text-xs">
              <span className="mb-1 block font-medium text-slate-600">{label as string}</span>
              <input value={value as string} disabled={!canEdit} onChange={(e) => (setter as (v: string) => void)(e.target.value)} className={input} />
            </label>
          ))}
          <label className="text-xs">
            <span className="mb-1 block font-medium text-slate-600">Fecha del informe</span>
            <input type="date" value={fechaInforme} disabled={!canEdit} onChange={(e) => setFechaInforme(e.target.value)} className={input} />
          </label>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {canEdit && (
          <button onClick={save} disabled={busy} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            Guardar planeación
          </button>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Incorrecciones no corregidas</p>
          <p className={`text-lg font-semibold ${superaMaterialidad ? "text-red-700" : "text-slate-900"}`}>{money(noCorregidas)}</p>
          <p className="text-xs text-slate-500">frente a materialidad global de {money(Number(engagement.materialidad_global))}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Opinión sugerida (NIA 450 / 705)</p>
          <p className="text-lg font-semibold text-slate-900">{OPINION_LABEL[sugerida]}</p>
          <p className="text-xs text-slate-500">La decisión final es del revisor fiscal (pestaña Dictamen).</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Opinión seleccionada</p>
          <p className="text-lg font-semibold text-slate-900">{OPINION_LABEL[engagement.opinion as Opinion]}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Señales de alerta del balance (procedimientos analíticos preliminares)</h2>
        {!hasTrialBalance ? (
          <p className="text-sm text-slate-500">Asocia un balance de prueba al encargo para analizarlo automáticamente.</p>
        ) : flags.length === 0 ? (
          <p className="text-sm text-green-700">No se detectaron saldos contrarios a su naturaleza ni variaciones significativas.</p>
        ) : (
          <ul className="space-y-1 text-sm text-amber-800">
            {flags.map((f) => (
              <li key={f}>• {f}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Matriz de riesgos
// ---------------------------------------------------------------------------

const LEVEL_STYLE: Record<string, string> = { alto: "bg-red-100 text-red-700", medio: "bg-amber-100 text-amber-700", bajo: "bg-green-100 text-green-700" };

export function RisksView({ engagementId, risks, canEdit }: { engagementId: string; risks: Risk[]; canEdit: boolean }) {
  const { busy, error, call } = useApi();
  const api = item("risks", engagementId);
  const [draft, setDraft] = useState({ area: "", afirmacion: "", descripcion: "", respuesta: "" });
  const run = (r: { url: string; method: string; body: object }) => call(r.url, r.method, r.body);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Riesgos de incorrección material por área y afirmación (NIA 315), con la respuesta planeada (NIA 330).
        Los riesgos significativos requieren procedimientos sustantivos específicos.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-2 py-2">Área / afirmación</th>
              <th className="px-2 py-2">Riesgo</th>
              <th className="px-2 py-2">Inherente</th>
              <th className="px-2 py-2">Control</th>
              <th className="px-2 py-2">Significativo</th>
              <th className="px-2 py-2">Respuesta</th>
              {canEdit && <th />}
            </tr>
          </thead>
          <tbody>
            {risks.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 align-top">
                <td className="px-2 py-2">
                  <b className="text-slate-800">{r.area}</b>
                  <span className="block text-slate-500">{r.afirmacion}</span>
                </td>
                <td className="px-2 py-2 text-slate-700">{r.descripcion}</td>
                {(["riesgo_inherente", "riesgo_control"] as const).map((field) => (
                  <td key={field} className="px-2 py-2">
                    {canEdit ? (
                      <select
                        value={r[field]}
                        onChange={(e) => run(api.update(r.id, { [field]: e.target.value }))}
                        className={`rounded px-1 py-0.5 ${LEVEL_STYLE[r[field]]}`}
                      >
                        <option value="alto">Alto</option>
                        <option value="medio">Medio</option>
                        <option value="bajo">Bajo</option>
                      </select>
                    ) : (
                      <span className={`rounded px-1.5 py-0.5 capitalize ${LEVEL_STYLE[r[field]]}`}>{r[field]}</span>
                    )}
                  </td>
                ))}
                <td className="px-2 py-2 text-center">
                  <input type="checkbox" checked={r.significativo} disabled={!canEdit || busy} onChange={(e) => run(api.update(r.id, { significativo: e.target.checked }))} />
                </td>
                <td className="px-2 py-2 text-slate-700">{r.respuesta}</td>
                {canEdit && (
                  <td className="px-2 py-2">
                    <button onClick={() => confirm("¿Eliminar este riesgo?") && run(api.remove(r.id))} className="text-red-600 hover:underline">
                      ✕
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(api.add({ ...draft, riesgo_inherente: "medio", riesgo_control: "medio", sort: risks.length }))) {
              setDraft({ area: "", afirmacion: "", descripcion: "", respuesta: "" });
            }
          }}
          className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-4"
        >
          <input required placeholder="Área" value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })} className={input} />
          <input placeholder="Afirmación" value={draft.afirmacion} onChange={(e) => setDraft({ ...draft, afirmacion: e.target.value })} className={input} />
          <input required placeholder="Descripción del riesgo" value={draft.descripcion} onChange={(e) => setDraft({ ...draft, descripcion: e.target.value })} className={input} />
          <input placeholder="Respuesta / procedimiento" value={draft.respuesta} onChange={(e) => setDraft({ ...draft, respuesta: e.target.value })} className={input} />
          <button type="submit" disabled={busy} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white md:col-span-4 md:w-fit">
            + Agregar riesgo
          </button>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Papeles de trabajo
// ---------------------------------------------------------------------------

const ESTADO_LABEL = { pendiente: "Pendiente", en_proceso: "En proceso", terminado: "Terminado" };

function WorkpaperCard({ paper, engagementId, canEdit }: { paper: Workpaper; engagementId: string; canEdit: boolean }) {
  const { busy, error, call } = useApi();
  const api = item("workpapers", engagementId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(paper);
  const set = (k: keyof Workpaper, v: string) => setForm({ ...form, [k]: v });
  const save = () => {
    const { id, ...data } = form;
    return call(api.update(id, data).url, "PATCH", api.update(id, data).body);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-2 text-left">
        <span className="text-sm font-semibold text-slate-900">
          <span className="mr-2 font-mono text-blue-700">{paper.ref}</span>
          {paper.titulo}
        </span>
        <span
          className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
            paper.estado === "terminado" ? "bg-green-100 text-green-700" : paper.estado === "en_proceso" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
          }`}
        >
          {ESTADO_LABEL[paper.estado]}
        </span>
      </button>
      {open && (
        <div className="mt-3 space-y-3 text-sm">
          <p className="text-slate-600"><b>Objetivo:</b> {paper.objetivo}</p>
          {(
            [
              ["procedimientos", "Procedimientos"],
              ["resultado", "Resultado de las pruebas y evidencia obtenida"],
              ["conclusion", "Conclusión"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="block text-xs">
              <span className="mb-1 block font-medium text-slate-600">{label}</span>
              <textarea value={form[k]} disabled={!canEdit} rows={k === "procedimientos" ? 6 : 3} onChange={(e) => set(k, e.target.value)} className={input} />
            </label>
          ))}
          <div className="grid gap-2 md:grid-cols-5">
            <select value={form.estado} disabled={!canEdit} onChange={(e) => set("estado", e.target.value)} className={input}>
              {Object.entries(ESTADO_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <input placeholder="Preparó" value={form.preparado_por ?? ""} disabled={!canEdit} onChange={(e) => set("preparado_por", e.target.value)} className={input} />
            <input type="date" value={form.fecha_preparacion ?? ""} disabled={!canEdit} onChange={(e) => set("fecha_preparacion", e.target.value)} className={input} />
            <input placeholder="Revisó" value={form.revisado_por ?? ""} disabled={!canEdit} onChange={(e) => set("revisado_por", e.target.value)} className={input} />
            <input type="date" value={form.fecha_revision ?? ""} disabled={!canEdit} onChange={(e) => set("fecha_revision", e.target.value)} className={input} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {canEdit && (
            <div className="flex gap-3">
              <button onClick={save} disabled={busy} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">
                Guardar papel de trabajo
              </button>
              <button
                onClick={() => confirm("¿Eliminar este papel de trabajo?") && call(api.remove(paper.id).url, "DELETE", api.remove(paper.id).body)}
                className="text-xs text-red-600 hover:underline"
              >
                Eliminar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function WorkpapersView({ engagementId, papers, canEdit }: { engagementId: string; papers: Workpaper[]; canEdit: boolean }) {
  const { busy, error, call } = useApi();
  const api = item("workpapers", engagementId);
  const [ref, setRef] = useState("");
  const [titulo, setTitulo] = useState("");
  const done = papers.filter((p) => p.estado === "terminado").length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-700">
          {done} de {papers.length} papeles de trabajo terminados
        </p>
        <div className="mt-2 h-2 rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-blue-600" style={{ width: `${papers.length ? (done / papers.length) * 100 : 0}%` }} />
        </div>
      </div>
      {papers.map((p) => (
        <WorkpaperCard key={`${p.id}-${p.estado}-${p.resultado.length}`} paper={p} engagementId={engagementId} canEdit={canEdit} />
      ))}
      {canEdit && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const r = api.add({ ref, titulo, sort: papers.length });
            if (await call(r.url, r.method, r.body)) {
              setRef("");
              setTitulo("");
            }
          }}
          className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-4"
        >
          <input required placeholder="Ref. (ej. C-2)" value={ref} onChange={(e) => setRef(e.target.value)} className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
          <input required placeholder="Título del papel de trabajo" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
          <button type="submit" disabled={busy} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white">
            + Agregar
          </button>
          {error && <p className="w-full text-sm text-red-600">{error}</p>}
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hallazgos
// ---------------------------------------------------------------------------

const TIPO_LABEL = {
  incorreccion: "Incorrección en estados financieros",
  control_interno: "Deficiencia de control interno",
  incumplimiento_legal: "Incumplimiento legal o normativo",
  otro: "Otro",
};

export function FindingsView({
  engagementId,
  findings,
  canEdit,
  refs,
  materialidad,
  trivial,
}: {
  engagementId: string;
  findings: Finding[];
  canEdit: boolean;
  refs: string[];
  materialidad: number;
  trivial: number;
}) {
  const { busy, error, call } = useApi();
  const api = item("findings", engagementId);
  const empty = { titulo: "", workpaper_ref: "", tipo: "incorreccion", condicion: "", criterio: "", causa: "", efecto: "", recomendacion: "", monto: "" };
  const [draft, setDraft] = useState(empty);
  const noCorregidas = findings.filter((f) => f.tipo === "incorreccion" && !f.corregido).reduce((s, f) => s + Math.abs(Number(f.monto)), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Incorrecciones no corregidas (NIA 450)</p>
          <p className={`text-lg font-semibold ${noCorregidas >= materialidad && materialidad > 0 ? "text-red-700" : "text-slate-900"}`}>{money(noCorregidas)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Materialidad global</p>
          <p className="text-lg font-semibold text-slate-900">{money(materialidad)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Umbral trivial (no se acumula por debajo)</p>
          <p className="text-lg font-semibold text-slate-900">{money(trivial)}</p>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {findings.map((f) => (
        <div key={f.id} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <p className="font-semibold text-slate-900">
              {f.workpaper_ref && <span className="mr-2 font-mono text-blue-700">{f.workpaper_ref}</span>}
              {f.titulo}
            </p>
            <div className="flex items-center gap-3 text-xs">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{TIPO_LABEL[f.tipo]}</span>
              {f.tipo === "incorreccion" && (
                <>
                  <b>{money(Number(f.monto))}</b>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={f.corregido} disabled={!canEdit || busy} onChange={(e) => { const r = api.update(f.id, { corregido: e.target.checked }); call(r.url, r.method, r.body); }} />
                    Corregido por la administración
                  </label>
                </>
              )}
              {canEdit && (
                <button onClick={() => { if (confirm("¿Eliminar el hallazgo?")) { const r = api.remove(f.id); call(r.url, r.method, r.body); } }} className="text-red-600 hover:underline">
                  Eliminar
                </button>
              )}
            </div>
          </div>
          <dl className="grid gap-x-6 gap-y-1 text-xs text-slate-700 md:grid-cols-2">
            {([["Condición", f.condicion], ["Criterio", f.criterio], ["Causa", f.causa], ["Efecto", f.efecto], ["Recomendación", f.recomendacion]] as const)
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="font-medium text-slate-500">{k}</dt>
                  <dd className="whitespace-pre-line">{v}</dd>
                </div>
              ))}
          </dl>
        </div>
      ))}
      {canEdit && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const r = api.add({ ...draft, monto: Number(String(draft.monto).replace(/[^\d.-]/g, "")) || 0 });
            if (await call(r.url, r.method, r.body)) setDraft(empty);
          }}
          className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4"
        >
          <h3 className="text-sm font-semibold text-slate-900">Nuevo hallazgo</h3>
          <div className="grid gap-2 md:grid-cols-4">
            <input required placeholder="Título" value={draft.titulo} onChange={(e) => setDraft({ ...draft, titulo: e.target.value })} className={`${input} md:col-span-2`} />
            <select value={draft.tipo} onChange={(e) => setDraft({ ...draft, tipo: e.target.value })} className={input}>
              {Object.entries(TIPO_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <select value={draft.workpaper_ref} onChange={(e) => setDraft({ ...draft, workpaper_ref: e.target.value })} className={input}>
              <option value="">Papel de trabajo…</option>
              {refs.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {(["condicion", "criterio", "causa", "efecto", "recomendacion"] as const).map((k) => (
              <textarea key={k} placeholder={k.charAt(0).toUpperCase() + k.slice(1)} rows={2} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} className={input} />
            ))}
            {draft.tipo === "incorreccion" && (
              <input placeholder="Monto de la incorrección" value={draft.monto} onChange={(e) => setDraft({ ...draft, monto: e.target.value })} className={input} />
            )}
          </div>
          <button type="submit" disabled={busy} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white">
            Registrar hallazgo
          </button>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dictamen, informe del art. 209 y carta de representación
// ---------------------------------------------------------------------------

function SectionBlock({ section, engagementId, canEdit }: { section: DocSection; engagementId: string; canEdit: boolean }) {
  const { busy, error, call } = useApi();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(section.text);
  const save = async (content: string) => {
    if (await call(`/api/audit/engagements/${engagementId}/documents`, "PUT", { doc_key: section.key, content })) setEditing(false);
  };

  return (
    <div className="break-inside-avoid py-3">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{section.title}</h3>
        {canEdit && !editing && (
          <div className="flex gap-2 print:hidden">
            {section.edited && (
              <button onClick={() => save("")} className="text-xs text-slate-500 hover:underline">
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
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={Math.min(24, text.split("\n").length + 3)} className="w-full rounded-lg border border-slate-300 p-3 text-sm" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="mt-2 flex gap-2">
            <button onClick={() => save(text)} disabled={busy} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">
              Guardar
            </button>
            <button onClick={() => { setText(section.text); setEditing(false); }} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-line text-justify text-sm leading-relaxed text-slate-700">{section.text}</p>
      )}
    </div>
  );
}

export function DocumentView({
  engagementId,
  title,
  sections,
  canEdit,
  opinionControl,
}: {
  engagementId: string;
  title: string;
  sections: DocSection[];
  canEdit: boolean;
  opinionControl: { opinion: Opinion; sugerida: Opinion; generalizado: boolean } | null;
}) {
  const { busy, call } = useApi();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <button onClick={() => window.print()} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Imprimir / Guardar PDF
        </button>
        {opinionControl && canEdit && (
          <>
            <select
              value={opinionControl.opinion}
              disabled={busy}
              onChange={(e) => call(`/api/audit/engagements/${engagementId}`, "PATCH", { opinion: e.target.value })}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            >
              {(Object.keys(OPINION_LABEL) as Opinion[]).map((o) => (
                <option key={o} value={o}>{OPINION_LABEL[o]}</option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={opinionControl.generalizado}
                disabled={busy}
                onChange={(e) => call(`/api/audit/engagements/${engagementId}`, "PATCH", { generalizado: e.target.checked })}
              />
              Efectos generalizados
            </label>
            {opinionControl.sugerida !== opinionControl.opinion && (
              <span className="text-xs text-amber-700">Según los hallazgos se sugiere: {OPINION_LABEL[opinionControl.sugerida]}</span>
            )}
          </>
        )}
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 print:border-0 print:p-0">
        <h2 className="mb-2 text-center text-base font-bold uppercase text-slate-900">{title}</h2>
        {sections.map((s) => (
          <SectionBlock key={`${s.key}-${s.text.length}`} section={s} engagementId={engagementId} canEdit={canEdit} />
        ))}
      </section>
      <p className="text-xs text-slate-500 print:hidden">
        Borrador generado según las NIA adoptadas por el Decreto 2420 de 2015. El revisor fiscal debe revisarlo y
        ajustarlo con su juicio profesional antes de firmarlo.
      </p>
    </div>
  );
}
