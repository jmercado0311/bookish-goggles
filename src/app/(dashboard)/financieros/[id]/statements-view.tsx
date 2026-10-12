import type { BalanceSheet, CashFlow, EquityChanges, StatementLine } from "@/lib/financial/statements";
import { EQUITY_COLUMNS } from "@/lib/financial/statements";
import type { FrameworkSpec } from "@/lib/financial/frameworks";
import type { ComplianceCheck } from "@/lib/financial/compliance";
import { ReportHeader, fechaLarga, money, type ReportInfo } from "./report-header";
import { ReportToolbar } from "./report-toolbar";

const ROW_STYLE: Record<0 | 1 | 2, string> = {
  0: "text-slate-700",
  1: "font-semibold text-slate-900 border-t border-slate-200",
  2: "font-bold text-slate-900 border-t-2 border-slate-400",
};

function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <section className="break-after-page rounded-2xl border border-slate-200 bg-white p-6 print:rounded-none print:border-0 print:p-0">
      {children}
    </section>
  );
}

function StatementTable({
  lines,
  currentLabel,
  previousLabel,
}: {
  lines: StatementLine[];
  currentLabel: string;
  previousLabel: string | null;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-300 text-xs text-slate-500">
          <th className="py-1 text-left font-medium" />
          <th className="py-1 text-right font-medium">{currentLabel}</th>
          {previousLabel && <th className="py-1 text-right font-medium">{previousLabel}</th>}
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr key={l.key} className={ROW_STYLE[l.level]}>
            <td className={`py-1 ${l.level === 0 ? "pl-3" : ""}`}>{l.label}</td>
            <td className="py-1 text-right tabular-nums">{money(l.current)}</td>
            {previousLabel && <td className="py-1 text-right tabular-nums">{money(l.previous)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const CHECK_STYLE: Record<ComplianceCheck["status"], { icon: string; color: string }> = {
  ok: { icon: "✓", color: "text-green-700" },
  alerta: { icon: "!", color: "text-amber-700" },
  error: { icon: "✕", color: "text-red-700" },
};

function ComplianceList({ spec, checks }: { spec: FrameworkSpec; checks: ComplianceCheck[] }) {
  const errors = checks.filter((c) => c.status === "error").length;
  const alerts = checks.filter((c) => c.status === "alerta").length;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 print:hidden">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Verificación de cumplimiento · {spec.label}</h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            errors
              ? "bg-red-100 text-red-700"
              : alerts
                ? "bg-amber-100 text-amber-700"
                : "bg-green-100 text-green-700"
          }`}
        >
          {errors ? `${errors} por corregir` : alerts ? `${alerts} por revisar` : "Listo para emitir"}
        </span>
      </div>
      <ul className="space-y-1.5 text-sm">
        {checks.map((c) => (
          <li key={c.text} className="flex gap-2">
            <span className={`w-4 shrink-0 text-center font-bold ${CHECK_STYLE[c.status].color}`}>
              {CHECK_STYLE[c.status].icon}
            </span>
            <span className="text-slate-700">
              {c.text} <span className="text-xs text-slate-400">({c.ref})</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Certificación de los estados financieros (art. 37 Ley 222 de 1995). */
function Certification({
  info,
  spec,
  signatures,
}: {
  info: ReportInfo;
  spec: FrameworkSpec;
  signatures: React.ReactNode;
}) {
  return (
    <Sheet>
      <ReportHeader
        info={info}
        title="Certificación de los estados financieros"
        subtitle={`Al ${fechaLarga(info.periodEnd)}`}
      />
      <p className="text-justify text-sm leading-relaxed text-slate-700">
        Los suscritos representante legal y contador público de {info.razonSocial}, en cumplimiento del
        artículo 37 de la Ley 222 de 1995, certificamos que hemos verificado previamente las afirmaciones
        contenidas en los estados financieros al {fechaLarga(info.periodEnd)}, preparados conforme al{" "}
        {spec.label}, y que estas se han tomado fielmente de los libros de contabilidad: los activos y pasivos
        existen y las transacciones registradas ocurrieron durante el periodo; los hechos económicos fueron
        reconocidos en su totalidad; los activos representan derechos y los pasivos obligaciones de la
        entidad; los elementos han sido reconocidos por sus valores apropiados; y los hechos económicos han
        sido correctamente clasificados, descritos y revelados.
      </p>
      {signatures}
    </Sheet>
  );
}

export function StatementsView({
  info,
  spec,
  checks,
  balance,
  incomeLines,
  incomeClosed,
  equity,
  cash,
  signatures,
}: {
  info: ReportInfo;
  spec: FrameworkSpec;
  checks: ComplianceCheck[];
  balance: BalanceSheet;
  incomeLines: StatementLine[];
  incomeClosed: boolean;
  equity: EquityChanges;
  cash: CashFlow;
  signatures: React.ReactNode;
}) {
  const year = (iso: string) => iso.slice(0, 4);
  const currentLabel = year(info.periodEnd);
  // El saldo anterior del balance de prueba es el cierre del periodo previo
  const dayBeforeStart = new Date(`${info.periodStart}T00:00:00Z`);
  dayBeforeStart.setUTCDate(dayBeforeStart.getUTCDate() - 1);
  const previousBalanceLabel = year(dayBeforeStart.toISOString());
  const previousIncomeLabel = info.previousPeriodEnd ? year(info.previousPeriodEnd) : null;

  const cashSection = (
    title: string,
    items: { label: string; value: number }[],
    total: number,
    totalLabel: string,
  ) => (
    <>
      <tr className="font-semibold text-slate-900">
        <td className="pt-3" colSpan={2}>
          {title}
        </td>
      </tr>
      {items.map((i) => (
        <tr key={i.label} className="text-slate-700">
          <td className="py-1 pl-3">{i.label}</td>
          <td className="py-1 text-right tabular-nums">{money(i.value)}</td>
        </tr>
      ))}
      <tr className={ROW_STYLE[1]}>
        <td className="py-1">{totalLabel}</td>
        <td className="py-1 text-right tabular-nums">{money(total)}</td>
      </tr>
    </>
  );

  return (
    <div className="space-y-6">
      <ComplianceList spec={spec} checks={checks} />

      <ReportToolbar
        info={info}
        spec={spec}
        balance={balance.lines}
        income={incomeLines}
        equity={equity}
        cash={cash}
        labels={{
          current: currentLabel,
          previousBalance: previousBalanceLabel,
          previousIncome: previousIncomeLabel,
        }}
      />

      <Sheet>
        <ReportHeader
          info={info}
          title={spec.statements.situacion}
          subtitle={`Al ${fechaLarga(info.periodEnd)}, comparativo`}
        />
        <StatementTable
          lines={balance.lines}
          currentLabel={currentLabel}
          previousLabel={previousBalanceLabel}
        />
        {signatures}
      </Sheet>

      <Sheet>
        <ReportHeader
          info={info}
          title={spec.statements.resultados}
          subtitle={`Del ${fechaLarga(info.periodStart)} al ${fechaLarga(info.periodEnd)}`}
        />
        {incomeClosed && (
          <p className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800 print:hidden">
            Las cuentas de resultados (clases 4 a 7) ya están cerradas en este balance, por eso solo se conoce
            el resultado neto. Para el detalle, sube el balance de prueba antes del cierre.
          </p>
        )}
        <StatementTable lines={incomeLines} currentLabel={currentLabel} previousLabel={previousIncomeLabel} />
        {spec.ori && (
          <table className="mt-2 w-full text-sm">
            <tbody>
              <tr className="font-semibold text-slate-900">
                <td className="pt-3" colSpan={2}>
                  Otro resultado integral
                </td>
              </tr>
              {spec.oriDividido ? (
                <>
                  <tr className="text-slate-700">
                    <td className="py-1 pl-3">Partidas que no se reclasificarán al resultado del periodo</td>
                    <td className="py-1 text-right tabular-nums">{money(equity.rows[2].total)}</td>
                  </tr>
                  <tr className="text-slate-700">
                    <td className="py-1 pl-3">
                      Partidas que pueden reclasificarse posteriormente al resultado del periodo
                    </td>
                    <td className="py-1 text-right tabular-nums">{money(0)}</td>
                  </tr>
                </>
              ) : (
                <tr className="text-slate-700">
                  <td className="py-1 pl-3">Otro resultado integral del periodo</td>
                  <td className="py-1 text-right tabular-nums">{money(equity.rows[2].total)}</td>
                </tr>
              )}
              <tr className={ROW_STYLE[2]}>
                <td className="py-1">Resultado integral total del periodo</td>
                <td className="py-1 text-right tabular-nums">
                  {money(incomeLines[incomeLines.length - 1].current + equity.rows[2].total)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
        {signatures}
      </Sheet>

      {spec.statements.patrimonio && (
        <Sheet>
          <ReportHeader
            info={info}
            title={spec.statements.patrimonio}
            subtitle={`Del ${fechaLarga(info.periodStart)} al ${fechaLarga(info.periodEnd)}`}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-300 text-slate-500">
                  <th className="py-1 text-left font-medium" />
                  {EQUITY_COLUMNS.map((c) => (
                    <th key={c.key} className="px-1 py-1 text-right font-medium">
                      {c.label}
                    </th>
                  ))}
                  <th className="px-1 py-1 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {equity.rows.map((r, i) => (
                  <tr
                    key={r.label}
                    className={i === 0 || i === equity.rows.length - 1 ? ROW_STYLE[1] : ROW_STYLE[0]}
                  >
                    <td className="py-1 pr-2">{r.label}</td>
                    {r.values.map((v, j) => (
                      <td key={j} className="px-1 py-1 text-right tabular-nums">
                        {money(v)}
                      </td>
                    ))}
                    <td className="px-1 py-1 text-right font-semibold tabular-nums">{money(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {signatures}
        </Sheet>
      )}

      {spec.statements.flujos && (
        <Sheet>
          <ReportHeader
            info={info}
            title={`${spec.statements.flujos} (método indirecto)`}
            subtitle={`Del ${fechaLarga(info.periodStart)} al ${fechaLarga(info.periodEnd)}`}
          />
          <table className="w-full text-sm">
            <tbody>
              {cashSection(
                "Flujos de efectivo de actividades de operación",
                cash.operacion,
                cash.total_operacion,
                "Efectivo neto de actividades de operación",
              )}
              {cashSection(
                "Flujos de efectivo de actividades de inversión",
                cash.inversion,
                cash.total_inversion,
                "Efectivo neto de actividades de inversión",
              )}
              {cashSection(
                "Flujos de efectivo de actividades de financiación",
                cash.financiacion,
                cash.total_financiacion,
                "Efectivo neto de actividades de financiación",
              )}
              <tr className={ROW_STYLE[2]}>
                <td className="pt-3">Aumento (disminución) neto del efectivo</td>
                <td className="pt-3 text-right tabular-nums">{money(cash.variacion_neta)}</td>
              </tr>
              <tr className="text-slate-700">
                <td className="py-1">Efectivo y equivalentes al inicio del periodo</td>
                <td className="py-1 text-right tabular-nums">{money(cash.efectivo_inicial)}</td>
              </tr>
              <tr className={ROW_STYLE[2]}>
                <td className="py-1">Efectivo y equivalentes al final del periodo</td>
                <td className="py-1 text-right tabular-nums">{money(cash.efectivo_final)}</td>
              </tr>
            </tbody>
          </table>
          {cash.diferencia !== 0 && (
            <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800 print:hidden">
              Diferencia de conciliación con el efectivo: {money(cash.diferencia)}. Suele deberse a cuentas
              sin clasificar, de orden o de cierre con saldo; revísalas en Clasificación de cuentas.
            </p>
          )}
          <p className="mt-3 text-xs text-slate-500 print:hidden">
            Flujo preparado por variación de saldos entre el inicio y el cierre del periodo. Revise partidas
            que no implican movimiento de efectivo (ventas de activos, capitalizaciones, dividendos por pagar)
            antes de emitirlo.
          </p>
          {signatures}
        </Sheet>
      )}

      <Certification info={info} spec={spec} signatures={signatures} />
    </div>
  );
}
