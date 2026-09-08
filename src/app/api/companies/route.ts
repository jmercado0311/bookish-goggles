import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export async function POST(request: Request) {
  const { supabase, user } = await requireAdmin();
  const body = await request.json();

  const { data, error } = await supabase
    .from("companies")
    .insert({ ...body, created_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ company: data });
}
