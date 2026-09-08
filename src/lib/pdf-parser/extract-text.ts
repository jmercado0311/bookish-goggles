"use client";

import * as pdfjsLib from "pdfjs-dist";

// Worker servido como asset estático (ver public/pdf.worker.min.mjs).
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export interface PositionedItem {
  text: string;
  x: number;
  y: number;
  page: number;
}

/** Extrae todo el texto del PDF con su posición aproximada, página por página. */
export async function extractPdfItems(file: File): Promise<PositionedItem[]> {
  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;

  const items: PositionedItem[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    for (const raw of content.items) {
      if (!("str" in raw) || !raw.str.trim()) continue;
      const transform = raw.transform as number[];
      items.push({
        text: raw.str.trim(),
        x: transform[4],
        y: transform[5],
        page: pageNum,
      });
    }
  }

  return items;
}
