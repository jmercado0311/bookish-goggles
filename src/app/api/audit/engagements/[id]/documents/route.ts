import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

// PUT: guarda el texto editado de una sección del dictamen, del informe 209 o
// de la carta de representación. Texto vacío = volver al texto generado.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAdmin();
  const { id } = await params;
  const { doc_key, content } = (await request.json()) as { doc_key?: string; content?: string };
  if (!doc_key || !/^[a-z0-9_]{1,60}$/.test(doc_key)) return NextResponse.json({ error: "Sección no válida." }, { status: 400 });

  if (!content?.trim()) {
    const { error } = await supabase.from("audit_documents").delete().eq("engagement_id", id).eq("doc_key", doc_key);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  const { error } = await supabase.from("audit_documents").upsert({
    engagement_id: id,
    doc_key,
    content: content.slice(0, 30000),
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
