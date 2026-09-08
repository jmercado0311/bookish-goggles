import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { responsibilityName } from "@/lib/tax-rules/responsibilities";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase } = await requireAdmin();
  const { id: company_id } = await params;
  const { code } = await request.json();

  if (!code) return NextResponse.json({ error: "Falta el código." }, { status: 400 });

  const { data, error } = await supabase
    .from("company_responsibilities")
    .insert({ company_id, code, name: responsibilityName(code) })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ responsibility: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase } = await requireAdmin();
  const { id: company_id } = await params;
  const { code } = await request.json();

  const { error } = await supabase
    .from("company_responsibilities")
    .delete()
    .eq("company_id", company_id)
    .eq("code", code);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
