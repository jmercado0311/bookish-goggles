import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

interface DeclarationKey {
  company_id: string;
  responsibility_code: string;
  period_label: string;
  due_date: string;
}

function validateBody(body: unknown): body is DeclarationKey {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.company_id === "string" &&
    typeof b.responsibility_code === "string" &&
    typeof b.period_label === "string" &&
    typeof b.due_date === "string"
  );
}

// POST: marca una declaración puntual como presentada.
// La política RLS de submitted_declarations exige que el usuario sea admin.
export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  const body = await request.json();

  if (!validateBody(body)) {
    return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("submitted_declarations")
    .upsert({ ...body, submitted_by: user.id }, { onConflict: "company_id,responsibility_code,period_label,due_date" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ declaration: data });
}

// DELETE: deshace una marca de "presentada" (por si fue un error).
export async function DELETE(request: Request) {
  const { supabase } = await requireUser();
  const body = await request.json();

  if (!validateBody(body)) {
    return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
  }

  const { error } = await supabase
    .from("submitted_declarations")
    .delete()
    .eq("company_id", body.company_id)
    .eq("responsibility_code", body.responsibility_code)
    .eq("period_label", body.period_label)
    .eq("due_date", body.due_date);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
