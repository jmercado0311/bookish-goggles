import { NextResponse } from "next/server";
import { requireAdmin, hasModule } from "@/lib/auth";

// PUT: guarda el texto editado de una nota. Texto vacío = volver al texto automático.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAdmin();
  const { id } = await params;

  if (!(await hasModule(supabase, "notas"))) {
    return NextResponse.json({ error: "Tu plan no incluye el módulo de notas." }, { status: 402 });
  }

  const { note_key, content } = (await request.json()) as { note_key?: string; content?: string };
  if (!note_key || !/^[a-z0-9_]{1,60}$/.test(note_key)) {
    return NextResponse.json({ error: "Nota no válida." }, { status: 400 });
  }

  if (!content?.trim()) {
    const { error } = await supabase
      .from("financial_notes")
      .delete()
      .eq("trial_balance_id", id)
      .eq("note_key", note_key);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase.from("financial_notes").upsert({
    trial_balance_id: id,
    note_key,
    content: content.slice(0, 20000),
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
