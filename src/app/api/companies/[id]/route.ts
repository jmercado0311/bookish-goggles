import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { trimStringFields } from "@/lib/trim-fields";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase } = await requireAdmin();
  const { id } = await params;
  const body = trimStringFields(await request.json());

  const { data, error } = await supabase
    .from("companies")
    .update(body)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Ya existe otra empresa registrada con ese NIT." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ company: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase } = await requireAdmin();
  const { id } = await params;

  const { error } = await supabase.from("companies").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
