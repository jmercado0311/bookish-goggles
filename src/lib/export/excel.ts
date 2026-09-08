import ExcelJS from "exceljs";
import type { CompanyDeadline } from "@/lib/types";

export async function exportDeadlinesToExcel(deadlines: CompanyDeadline[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Vencimientos");

  sheet.columns = [
    { header: "Empresa", key: "empresa", width: 32 },
    { header: "NIT", key: "nit", width: 16 },
    { header: "Obligación", key: "obligacion", width: 32 },
    { header: "Periodo", key: "periodo", width: 20 },
    { header: "Vence", key: "vence", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const d of deadlines) {
    sheet.addRow({
      empresa: d.company.razon_social,
      nit: d.company.nit,
      obligacion: d.responsibility_name,
      periodo: d.period_label,
      vence: d.due_date,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `vencimientos-${new Date().toISOString().slice(0, 10)}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
