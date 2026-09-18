import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import type { NitMatchMode } from "@/lib/types";

interface ReviewedEntry {
  responsibility_code: string;
  last_nit_digit: number;
  match_mode?: NitMatchMode;
  period_label: string;
  due_date: string;
}

export async function POST(request: Request) {
  const { supabase, user } = await requireAdmin();
  const { year, file_path, entries } = (await request.json()) as {
    year: number;
    file_path: string;
    entries: ReviewedEntry[];
  };

  if (!year || !entries?.length) {
    return NextResponse.json({ error: "Falta el año o no hay filas confirmadas." }, { status: 400 });
  }

  const { data: upload, error: uploadError } = await supabase
    .from("calendar_uploads")
    .insert({
      year,
      file_path: file_path ?? "",
      status: "confirmado",
      uploaded_by: user.id,
      confirmed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const rows = entries.map((e) => ({
    // El año de cada fila sale de su propia fecha (no del año del formulario):
    // algunos vencimientos "hasta enero" quedan en el año siguiente aunque se
    // suban como parte del calendario del año en curso.
    year: Number(e.due_date.slice(0, 4)) || year,
    responsibility_code: e.responsibility_code,
    last_nit_digit: e.last_nit_digit,
    match_mode: e.match_mode ?? "last_digit",
    period_label: e.period_label,
    due_date: e.due_date,
  }));

  const { error: insertError } = await supabase
    .from("tax_calendar")
    .upsert(rows, { onConflict: "year,responsibility_code,last_nit_digit,period_label" });

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

  return NextResponse.json({ upload, inserted: rows.length });
}
