import ExcelJS from "exceljs";
import type { Match, ReconciliationSummary, UnmatchedItem } from "@/lib/ledger/reconcile";

interface Input {
  header: { razonSocial: string; nit: string; cuenta: string; cuentaContable: string | null; periodEnd: string };
  summary: ReconciliationSummary;
  items: UnmatchedItem[];
  matches: Match[];
  byId: Map<string, { fecha: string; documento: string; descripcion: string; valor: number }>;
}

const FMT = "#,##0.00;(#,##0.00);-";

export async function exportReconciliationToExcel({ header, summary, items, matches, byId }: Input) {
  const wb = new ExcelJS.Workbook();

  const ws = wb.addWorksheet("Conciliación");
  ws.columns = [{ width: 48 }, { width: 20 }];
  for (const line of [header.razonSocial, `NIT ${header.nit}`, `Conciliación bancaria · ${header.cuenta}`, `Corte ${header.periodEnd}${header.cuentaContable ? ` · Cuenta ${header.cuentaContable}` : ""}`]) {
    ws.addRow([line]).font = { bold: true };
  }
  ws.addRow([]);
  const rows: [string, number, boolean?][] = [
    ["Saldo según extracto", summary.saldoExtracto, true],
    ["(+) Consignaciones en tránsito", summary.consignacionesTransito],
    ["(−) Cheques y egresos pendientes de cobro", summary.chequesPendientes],
    ["Saldo conciliado", summary.saldoExtractoAjustado, true],
    ["", 0],
    ["Saldo según libros", summary.saldoLibros, true],
    ["(+) Notas crédito no registradas", summary.notasCredito],
    ["(−) Notas débito no registradas", summary.notasDebito],
    ["Saldo conciliado", summary.saldoLibrosAjustado, true],
    ["", 0],
    ["Diferencia", summary.diferencia, true],
  ];
  for (const [label, value, bold] of rows) {
    if (!label) {
      ws.addRow([]);
      continue;
    }
    const r = ws.addRow([label, value]);
    r.getCell(2).numFmt = FMT;
    if (bold) r.font = { bold: true };
  }

  const wp = wb.addWorksheet("Partidas conciliatorias");
  wp.columns = [
    { header: "Lado", width: 10 },
    { header: "Categoría", width: 26 },
    { header: "Fecha", width: 12 },
    { header: "Documento", width: 16 },
    { header: "Descripción", width: 40 },
    { header: "Valor", width: 16 },
    { header: "Tratamiento sugerido", width: 40 },
    { header: "Cuenta sugerida", width: 14 },
  ];
  wp.getRow(1).font = { bold: true };
  for (const i of items) {
    const r = wp.addRow([i.side, i.categoria.replace(/_/g, " "), i.movement.fecha, i.movement.documento, i.movement.descripcion, i.movement.valor, i.suggestion.concepto, i.suggestion.cuenta ?? ""]);
    r.getCell(6).numFmt = FMT;
  }

  const wm = wb.addWorksheet("Partidas conciliadas");
  wm.columns = [{ header: "Tipo", width: 14 }, { header: "Lado", width: 8 }, { header: "Fecha", width: 12 }, { header: "Documento", width: 16 }, { header: "Descripción", width: 40 }, { header: "Valor", width: 16 }];
  wm.getRow(1).font = { bold: true };
  for (const m of matches) {
    for (const [side, ids] of [["Banco", m.bank], ["Libros", m.ledger]] as const) {
      for (const x of ids) {
        const mv = byId.get(x);
        if (!mv) continue;
        wm.addRow([m.type, side, mv.fecha, mv.documento, mv.descripcion, mv.valor]).getCell(6).numFmt = FMT;
      }
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `conciliacion-${header.cuenta.replace(/\W+/g, "-")}-${header.periodEnd}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
