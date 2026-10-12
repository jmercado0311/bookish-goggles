import type { BalanceSheet, CashFlow, EquityChanges, StatementLine } from "@/lib/financial/statements";
import { EQUITY_COLUMNS } from "@/lib/financial/statements";
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

export function StatementsView({
  info,
  balance,
  incomeLines,
  incomeClosed,
  equity,
  cash,
  signatures,
}: {
  info: ReportInfo;
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

  const cashSection = (title: string, items: { label: string; value: number }[], total: number, totalLabel: string) => (
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
      <ReportToolbar
        info={info}
        balance={balance.lines}
        income={incomeLines}
        equity={equity}
        cash={cash}
        labels={{ current: currentLabel, previousBalance: previousBalanceLabel, previousIncome: previousIncomeLabel }}
      />

      <Sheet>
        <ReportHeader
          info={info}
          title="Estado de situación financiera"
          subtitle={`Al ${fechaLarga(info.periodEnd)}, comparativo`}
        />
        <StatementTable lines={balance.lines} currentLabel={currentLabel} previousLabel={previousBalanceLabel} />
        {signatures}
      </Sheet>

      <Sheet>
        <ReportHeader
          info={info}
          title="Estado de resultados integral"
          subtitle={`Del ${fechaLarga(info.periodStart)} al ${fechaLarga(info.periodEnd)}`}
        />
        {incomeClosed && (
          <p className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800 print:hidden">
            Las cuentas de resultados (clases 4 a 7) ya están cerradas en este balance, por eso solo se
            conoce el resultado neto. Para el detalle, sube el balance de prueba antes del cierre.
          </p>
        )}
        <StatementTable lines={incomeLines} currentLabel={currentLabel} previousLabel={previousIncomeLabel} />
        <table className="mt-2 w-full text-sm">
          <tbody>
            <tr className="text-slate-700">
              <td className="py-1 pl-3">Otro resultado integral del periodo</td>
              <td className="py-1 text-right tabular-nums">{money(equity.rows[2].total)}</td>
            </tr>
            <tr className={ROW_STYLE[2]}>
              <td className="py-1">Resultado integral total del periodo</td>
              <td className="py-1 text-right tabular-nums">
                {money(incomeLines[incomeLines.length - 1].current + equity.rows[2].total)}
              </td>
            </tr>
          </tbody>
        </table>
        {signatures}
      </Sheet>

      <Sheet>
        <ReportHeader
          info={info}
          title="Estado de cambios en el patrimonio"
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
                <tr key={r.label} className={i === 0 || i === equity.rows.length - 1 ? ROW_STYLE[1] : ROW_STYLE[0]}>
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

      <Sheet>
        <ReportHeader
          info={info}
          title="Estado de flujos de efectivo (método indirecto)"
          subtitle={`Del ${fechaLarga(info.periodStart)} al ${fechaLarga(info.periodEnd)}`}
        />
        <table className="w-full text-sm">
          <tbody>
            {cashSection("Flujos de efectivo de actividades de operación", cash.operacion, cash.total_operacion, "Efectivo neto de actividades de operación")}
            {cashSection("Flujos de efectivo de actividades de inversión", cash.inversion, cash.total_inversion, "Efectivo neto de actividades de inversión")}
            {cashSection("Flujos de efectivo de actividades de financiación", cash.financiacion, cash.total_financiacion, "Efectivo neto de actividades de financiación")}
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
          Flujo preparado por variación de saldos entre el inicio y el cierre del periodo. Revise
          partidas que no implican movimiento de efectivo (ventas de activos, capitalizaciones,
          dividendos por pagar) antes de emitirlo.
        </p>
        {signatures}
      </Sheet>
    </div>
  );
}
