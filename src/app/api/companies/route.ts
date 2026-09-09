import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { trimStringFields } from "@/lib/trim-fields";

export async function POST(request: Request) {
  const { supabase, user } = await requireAdmin();
  const body = trimStringFields(await request.json());

  const { data, error } = await supabase
    .from("companies")
    .insert({ ...body, created_by: user.id })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Ya existe una empresa registrada con ese NIT." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ company: data });
}
