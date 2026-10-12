import ExcelJS from "exceljs";
import type { CashFlow, EquityChanges, StatementLine } from "@/lib/financial/statements";
import { EQUITY_COLUMNS } from "@/lib/financial/statements";
import type { FrameworkSpec } from "@/lib/financial/frameworks";

interface ExportInput {
  info: { razonSocial: string; nit: string; periodStart: string; periodEnd: string };
  spec: FrameworkSpec;
  balance: StatementLine[];
  income: StatementLine[];
  equity: EquityChanges;
  cash: CashFlow;
  labels: { current: string; previousBalance: string; previousIncome: string | null };
}

const NUMBER_FORMAT = "#,##0;(#,##0);-";

function header(sheet: ExcelJS.Worksheet, info: ExportInput["info"], title: string, subtitle: string) {
  sheet.addRow([info.razonSocial]).font = { bold: true };
  sheet.addRow([`NIT ${info.nit}`]);
  sheet.addRow([title]).font = { bold: true };
  sheet.addRow([subtitle]);
  sheet.addRow(["(Cifras expresadas en pesos colombianos)"]);
  sheet.addRow([]);
}

function statementSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  info: ExportInput["info"],
  title: string,
  subtitle: string,
  lines: StatementLine[],
  currentLabel: string,
  previousLabel: string | null,
) {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = [{ width: 60 }, { width: 18 }, { width: 18 }];
  header(sheet, info, title, subtitle);
  sheet.addRow(["", currentLabel, previousLabel ?? ""]).font = { bold: true };
  for (const l of lines) {
    const row = sheet.addRow([
      l.label,
      Math.round(l.current),
      l.previous === null || !previousLabel ? null : Math.round(l.previous),
    ]);
    if (l.level > 0) row.font = { bold: true };
    row.getCell(2).numFmt = NUMBER_FORMAT;
    row.getCell(3).numFmt = NUMBER_FORMAT;
  }
}

export async function exportFinancialStatementsToExcel(input: ExportInput) {
  const { info, labels, spec } = input;
  const titles = spec.statements;
  const periodo = `Del ${info.periodStart} al ${info.periodEnd}`;
  const workbook = new ExcelJS.Workbook();

  statementSheet(
    workbook,
    "Situación financiera",
    info,
    titles.situacion,
    `Al ${info.periodEnd}`,
    input.balance,
    labels.current,
    labels.previousBalance,
  );
  statementSheet(
    workbook,
    "Resultados",
    info,
    titles.resultados,
    periodo,
    input.income,
    labels.current,
    labels.previousIncome,
  );

  // Grupo 3 (microempresas): el juego completo no incluye estos dos estados
  if (titles.patrimonio && titles.flujos) {
    const eq = workbook.addWorksheet("Cambios patrimonio");
    eq.columns = [{ width: 50 }, ...EQUITY_COLUMNS.map(() => ({ width: 16 })), { width: 16 }];
    header(eq, info, titles.patrimonio, periodo);
    eq.addRow(["", ...EQUITY_COLUMNS.map((c) => c.label), "Total"]).font = { bold: true };
    for (const r of input.equity.rows) {
      const row = eq.addRow([r.label, ...r.values.map(Math.round), Math.round(r.total)]);
      row.eachCell((cell, col) => {
        if (col > 1) cell.numFmt = NUMBER_FORMAT;
      });
    }

    const cf = workbook.addWorksheet("Flujos de efectivo");
    cf.columns = [{ width: 80 }, { width: 18 }];
    header(cf, info, `${titles.flujos} (método indirecto)`, periodo);
    const section = (
      title: string,
      items: { label: string; value: number }[],
      total: number,
      totalLabel: string,
    ) => {
      cf.addRow([title]).font = { bold: true };
      for (const i of items)
        cf.addRow([`   ${i.label}`, Math.round(i.value)]).getCell(2).numFmt = NUMBER_FORMAT;
      const t = cf.addRow([totalLabel, Math.round(total)]);
      t.font = { bold: true };
      t.getCell(2).numFmt = NUMBER_FORMAT;
    };
    const c = input.cash;
    section(
      "Actividades de operación",
      c.operacion,
      c.total_operacion,
      "Efectivo neto de actividades de operación",
    );
    section(
      "Actividades de inversión",
      c.inversion,
      c.total_inversion,
      "Efectivo neto de actividades de inversión",
    );
    section(
      "Actividades de financiación",
      c.financiacion,
      c.total_financiacion,
      "Efectivo neto de actividades de financiación",
    );
    for (const [label, value] of [
      ["Aumento (disminución) neto del efectivo", c.variacion_neta],
      ["Efectivo al inicio del periodo", c.efectivo_inicial],
      ["Efectivo al final del periodo", c.efectivo_final],
    ] as const) {
      const row = cf.addRow([label, Math.round(value)]);
      row.font = { bold: true };
      row.getCell(2).numFmt = NUMBER_FORMAT;
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `estados-financieros-${info.nit}-${info.periodEnd}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
