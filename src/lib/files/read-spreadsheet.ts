import { parseCsv, type Cell } from "@/lib/financial/parse-trial-balance";

/**
 * Lectura de Excel (.xlsx) o CSV en el navegador como una matriz de celdas.
 * La usan el importador del balance de prueba y el del calendario ICA.
 */

/** Valor plano de una celda de ExcelJS (fórmulas, texto enriquecido, fechas). */
function plainCellValue(value: unknown): Cell {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as { result?: unknown; richText?: { text: string }[]; text?: string };
    if (v.result !== undefined) return plainCellValue(v.result);
    if (v.richText) return v.richText.map((t) => t.text).join("");
    if (v.text !== undefined) return v.text;
  }
  return String(value);
}

export async function readFileRows(file: File): Promise<Cell[][]> {
  if (/\.(csv|txt)$/i.test(file.name)) {
    const buffer = await file.arrayBuffer();
    // Muchos programas contables exportan CSV en Windows-1252 (tildes)
    let text = new TextDecoder("utf-8").decode(buffer);
    if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buffer);
    return parseCsv(text);
  }
  if (/\.xls$/i.test(file.name)) {
    throw new Error("El formato .xls (Excel 97-2003) no es compatible. Ábrelo en Excel y guárdalo como .xlsx.");
  }
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("El archivo no tiene hojas.");
  const rows: Cell[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const values = row.values as unknown[]; // índice 0 vacío en ExcelJS
    rows[rowNumber - 1] = values.slice(1).map(plainCellValue);
  });
  return Array.from(rows, (r) => r ?? []);
}
