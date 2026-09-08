import type { CompanyDeadline } from "@/lib/types";
import { urgencyLevel, daysUntil, DIAS_ANTICIPACION_REQUERIDA } from "@/lib/tax-rules/urgency";

const URGENCY_COLOR: Record<string, string> = {
  vencido: "#dc2626",
  urgente: "#d97706",
  proximo: "#2563eb",
  normal: "#475569",
};

export function buildWeeklyDigestHtml(userName: string, weekDeadlines: CompanyDeadline[]): string {
  const rows = weekDeadlines
    .map((d) => {
      const level = urgencyLevel(d.due_date);
      const days = daysUntil(d.due_date);
      const color = URGENCY_COLOR[level];
      const dias = days === 0 ? "hoy" : days === 1 ? "mañana" : `en ${days} días`;
      return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${d.company.razon_social}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${d.responsibility_name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${new Date(
            d.due_date + "T00:00:00"
          ).toLocaleDateString("es-CO")}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:${color};font-weight:600;">
            ${level === "vencido" ? "VENCIDO" : level === "urgente" ? `¡Urgente! (${dias})` : dias}
          </td>
        </tr>`;
    })
    .join("");

  const empty = `<p style="color:#475569;">No tienes vencimientos esta semana. ¡Buen momento para adelantar trabajo! 💪</p>`;

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;">
    <h2 style="color:#0f172a;">Hola ${userName} 👋</h2>
    <p style="color:#334155;">
      Aquí están los vencimientos tributarios de esta semana. ¡Vamos con todo, un buen equipo
      siempre entrega a tiempo! Recuerda dejar la información lista con al menos
      <strong>${DIAS_ANTICIPACION_REQUERIDA} días de anticipación</strong> al vencimiento,
      para que no haya afanes de último momento.
    </p>
    ${
      weekDeadlines.length === 0
        ? empty
        : `<table style="width:100%;border-collapse:collapse;margin-top:16px;">
            <thead>
              <tr style="background:#f1f5f9;text-align:left;">
                <th style="padding:8px 12px;">Empresa</th>
                <th style="padding:8px 12px;">Obligación</th>
                <th style="padding:8px 12px;">Vence</th>
                <th style="padding:8px 12px;">Estado</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>`
    }
    <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
      Vencimientos Tributarios · correo automático de los lunes
    </p>
  </div>`;
}
