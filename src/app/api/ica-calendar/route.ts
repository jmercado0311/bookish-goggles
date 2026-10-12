import { NextResponse } from "next/server";
import { hasModule, requireAdmin } from "@/lib/auth";

const PERIODICIDADES = ["mensual", "bimestral", "cuatrimestral", "semestral", "anual"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface EntryInput {
  period_label?: string;
  due_date?: string;
  last_nit_digit?: number | string | null;
}

/** Para ilike: el municipio se compara sin distinguir mayúsculas, sin comodines. */
const likeExact = (text: string) => text.replace(/[%_\\]/g, (c) => `\\${c}`);

function validKey(body: { municipio?: string; year?: number; periodicidad?: string }) {
  const municipio = String(body.municipio ?? "").trim();
  const year = Number(body.year);
  const periodicidad = String(body.periodicidad ?? "");
  if (!municipio || !Number.isInteger(year) || year < 2000 || year > 2100 || !PERIODICIDADES.includes(periodicidad)) {
    return null;
  }
  return { municipio, year, periodicidad };
}

// POST: guarda (reemplaza) el calendario ICA de un municipio, año y periodicidad del despacho
export async function POST(request: Request) {
  const { supabase, user, profile } = await requireAdmin();
  if (!(await hasModule(supabase, "vencimientos"))) {
    return NextResponse.json({ error: "Tu plan no incluye el módulo de vencimientos." }, { status: 402 });
  }

  const body = await request.json();
  const key = validKey(body);
  if (!key) return NextResponse.json({ error: "Falta municipio, año o periodicidad." }, { status: 400 });

  const entries = (Array.isArray(body.entries) ? body.entries : []) as EntryInput[];
  const rows = entries.map((e) => {
    const digit = e.last_nit_digit === null || e.last_nit_digit === undefined || e.last_nit_digit === "" ? null : Number(e.last_nit_digit);
    return {
      organization_id: profile.organization_id,
      ...key,
      period_label: String(e.period_label ?? "").trim().slice(0, 80),
      due_date: String(e.due_date ?? ""),
      last_nit_digit: digit,
      source_file_name: body.source_file_name ? String(body.source_file_name).slice(0, 200) : null,
      created_by: user.id,
    };
  });

  if (rows.length === 0 || rows.length > 2000) {
    return NextResponse.json({ error: "Agrega al menos una fecha." }, { status: 400 });
  }
  const invalid = rows.find(
    (r) =>
      !r.period_label ||
      !ISO_DATE.test(r.due_date) ||
      (r.last_nit_digit !== null && !(Number.isInteger(r.last_nit_digit) && r.last_nit_digit >= 0 && r.last_nit_digit <= 9))
  );
  if (invalid) {
    return NextResponse.json(
      { error: `Revisa la fila "${invalid.period_label || "sin periodo"}": periodo, fecha y dígito (0 a 9) deben ser válidos.` },
      { status: 400 }
    );
  }
  const seen = new Set<string>();
  for (const r of rows) {
    const k = `${r.period_label.toLowerCase()}|${r.last_nit_digit ?? "todos"}`;
    if (seen.has(k)) {
      return NextResponse.json(
        { error: `El periodo "${r.period_label}" está repetido para el mismo dígito.` },
        { status: 400 }
      );
    }
    seen.add(k);
  }

  const { error: deleteError } = await supabase
    .from("ica_calendar")
    .delete()
    .ilike("municipio", likeExact(key.municipio))
    .eq("year", key.year)
    .eq("periodicidad", key.periodicidad);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

  const { error } = await supabase.from("ica_calendar").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ inserted: rows.length });
}

// DELETE: elimina el calendario ICA de un municipio, año y periodicidad
export async function DELETE(request: Request) {
  const { supabase } = await requireAdmin();
  const key = validKey(await request.json());
  if (!key) return NextResponse.json({ error: "Falta municipio, año o periodicidad." }, { status: 400 });

  const { error } = await supabase
    .from("ica_calendar")
    .delete()
    .ilike("municipio", likeExact(key.municipio))
    .eq("year", key.year)
    .eq("periodicidad", key.periodicidad);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
