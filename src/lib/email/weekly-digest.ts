import type { CompanyDeadline } from "@/lib/types";
import { urgencyLevel, daysUntil, DIAS_ANTICIPACION_REQUERIDA } from "@/lib/tax-rules/urgency";

/** Semanas siguientes (después de la actual) que se anticipan en el correo. */
export const SEMANAS_ADELANTE = 4;

const URGENCY_COLOR: Record<string, string> = {
  vencido: "#dc2626",
  urgente: "#d97706",
  proximo: "#2563eb",
  normal: "#475569",
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

const fechaCorta = (d: Date) => d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });

const fechaDia = (iso: string) => {
  const text = new Date(`${iso}T00:00:00`).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
  return text.charAt(0).toUpperCase() + text.slice(1);
};

function estado(d: CompanyDeadline): { text: string; color: string } {
  const level = urgencyLevel(d.due_date);
  const days = daysUntil(d.due_date);
  if (level === "vencido") return { text: `VENCIDO hace ${Math.abs(days)} día${days === -1 ? "" : "s"}`, color: URGENCY_COLOR.vencido };
  const dias = days === 0 ? "hoy" : days === 1 ? "mañana" : `en ${days} días`;
  return { text: level === "urgente" ? `¡Urgente! (${dias})` : dias, color: URGENCY_COLOR[level] };
}

function table(rows: CompanyDeadline[], showDate: boolean): string {
  const body = rows
    .map((d) => {
      const e = estado(d);
      return `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(d.company.razon_social)}<br><span style="color:#94a3b8;font-size:12px;">NIT ${escapeHtml(d.company.nit)}</span></td>
          <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(d.responsibility_name)}<br><span style="color:#94a3b8;font-size:12px;">${escapeHtml(d.period_label)}</span></td>
          ${showDate ? `<td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;white-space:nowrap;">${new Date(`${d.due_date}T00:00:00`).toLocaleDateString("es-CO")}</td>` : ""}
          <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;color:${e.color};font-weight:600;white-space:nowrap;">${e.text}</td>
        </tr>`;
    })
    .join("");
  return `
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead>
        <tr style="background:#f1f5f9;text-align:left;font-size:12px;color:#475569;">
          <th style="padding:6px 10px;">Empresa</th>
          <th style="padding:6px 10px;">Obligación</th>
          ${showDate ? '<th style="padding:6px 10px;">Vence</th>' : ""}
          <th style="padding:6px 10px;">Estado</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`;
}

function section(title: string, color: string, inner: string): string {
  return `
    <h3 style="margin:28px 0 8px;padding-bottom:4px;border-bottom:2px solid ${color};color:#0f172a;font-size:16px;">${title}</h3>
    ${inner}`;
}

const byDate = (a: CompanyDeadline, b: CompanyDeadline) =>
  a.due_date.localeCompare(b.due_date) || a.company.razon_social.localeCompare(b.company.razon_social, "es");

/**
 * Correo de los lunes: vencidos sin presentar, la semana en curso día por
 * día y las próximas semanas, semana por semana, para que el equipo
 * planee con anticipación y no solo reaccione a lo inmediato.
 *
 * `pending` son los vencimientos del usuario que aún no se han presentado.
 */
export function buildWeeklyDigest(
  userName: string,
  pending: CompanyDeadline[],
  monday: Date
): { subject: string; html: string; total: number } {
  const weekStart = toIso(monday);
  const weekEnd = toIso(addDays(monday, 6));
  const today = toIso(new Date());

  const vencidos = pending.filter((d) => d.due_date < today).sort(byDate);
  const semana = pending.filter((d) => d.due_date >= weekStart && d.due_date <= weekEnd && d.due_date >= today).sort(byDate);
  const futuras = Array.from({ length: SEMANAS_ADELANTE }, (_, i) => {
    const start = addDays(monday, 7 * (i + 1));
    const end = addDays(start, 6);
    return {
      label: `Semana del ${fechaCorta(start)} al ${fechaCorta(end)}`,
      rows: pending.filter((d) => d.due_date >= toIso(start) && d.due_date <= toIso(end)).sort(byDate),
    };
  });
  const totalFuturas = futuras.reduce((s, w) => s + w.rows.length, 0);

  // Esta semana, agrupada por día
  const dias = [...new Set(semana.map((d) => d.due_date))];
  const semanaHtml =
    semana.length === 0
      ? `<p style="color:#475569;">No hay vencimientos pendientes esta semana. ¡Buen momento para adelantar lo de las próximas! 💪</p>`
      : dias
          .map(
            (dia) => `
              <p style="margin:14px 0 6px;font-weight:600;color:#1e293b;">${fechaDia(dia)}</p>
              ${table(semana.filter((d) => d.due_date === dia), false)}`
          )
          .join("");

  const futurasHtml = futuras
    .map(
      (w) => `
        <p style="margin:14px 0 6px;font-weight:600;color:#1e293b;">${w.label} · ${w.rows.length} vencimiento${w.rows.length === 1 ? "" : "s"}</p>
        ${w.rows.length ? table(w.rows, true) : '<p style="color:#94a3b8;font-size:13px;margin:0;">Sin vencimientos.</p>'}`
    )
    .join("");

  const card = (value: number, label: string, color: string) => `
    <td style="padding:10px;text-align:center;background:#f8fafc;border-radius:8px;">
      <div style="font-size:24px;font-weight:700;color:${color};">${value}</div>
      <div style="font-size:12px;color:#475569;">${label}</div>
    </td>`;

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;color:#334155;">
    <p style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 4px;">Contaryx</p>
    <h2 style="color:#0f172a;margin:0 0 12px;">Hola ${escapeHtml(userName)} 👋</h2>
    <p>
      Este es el panorama tributario de la semana del <strong>${fechaCorta(monday)}</strong> al
      <strong>${fechaCorta(addDays(monday, 6))}</strong> y de las ${SEMANAS_ADELANTE} semanas siguientes.
      Recuerda dejar la información lista con al menos <strong>${DIAS_ANTICIPACION_REQUERIDA} días de anticipación</strong>
      al vencimiento.
    </p>
    <table style="width:100%;border-collapse:separate;border-spacing:8px 0;margin:16px 0;">
      <tr>
        ${card(vencidos.length, "Vencidos sin presentar", "#dc2626")}
        ${card(semana.length, "Esta semana", "#d97706")}
        ${card(totalFuturas, `Próximas ${SEMANAS_ADELANTE} semanas`, "#2563eb")}
      </tr>
    </table>
    ${vencidos.length ? section("⚠️ Vencidos sin presentar", "#dc2626", `<p style="font-size:13px;margin:0 0 6px;">Preséntalos cuanto antes: la sanción por extemporaneidad (art. 641 E.T.) aumenta cada mes o fracción de retardo. Si ya se presentaron, márcalos como presentados en la app.</p>${table(vencidos, true)}`) : ""}
    ${section("📅 Esta semana", "#d97706", semanaHtml)}
    ${section(`🗓️ Próximas ${SEMANAS_ADELANTE} semanas`, "#2563eb", futurasHtml)}
    <p style="color:#94a3b8;font-size:12px;margin-top:28px;">
      Contaryx · correo automático de los lunes. Solo incluye obligaciones pendientes (no marcadas como presentadas).
    </p>
  </div>`;

  const total = vencidos.length + semana.length;
  const subject =
    `Contaryx · Semana del ${fechaCorta(monday)}: ${semana.length} vencimiento${semana.length === 1 ? "" : "s"}` +
    (vencidos.length ? ` y ${vencidos.length} vencido${vencidos.length === 1 ? "" : "s"} sin presentar` : "") +
    (totalFuturas ? ` · ${totalFuturas} en las próximas semanas` : "");

  return { subject, html, total: total + totalFuturas };
}
