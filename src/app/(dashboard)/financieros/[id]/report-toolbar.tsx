"use client";

import type { CashFlow, EquityChanges, StatementLine } from "@/lib/financial/statements";
import { exportFinancialStatementsToExcel } from "@/lib/export/financial-excel";
import type { ReportInfo } from "./report-header";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      Imprimir / Guardar PDF
    </button>
  );
}

export function ReportToolbar(props: {
  info: ReportInfo;
  balance: StatementLine[];
  income: StatementLine[];
  equity: EquityChanges;
  cash: CashFlow;
  labels: { current: string; previousBalance: string; previousIncome: string | null };
}) {
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <PrintButton />
      <button
        onClick={() => exportFinancialStatementsToExcel(props)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Descargar Excel
      </button>
    </div>
  );
}
