import { NextResponse } from "next/server";
import { requirePlatformOwner } from "@/lib/auth";

// PATCH: cambia el precio, nombre, descripción o disponibilidad de un módulo
export async function PATCH(request: Request) {
  const { supabase } = await requirePlatformOwner();
  const body = (await request.json()) as {
    code?: string;
    price_cop?: number;
    name?: string;
    description?: string;
    active?: boolean;
  };

  if (!body.code) return NextResponse.json({ error: "Falta el módulo." }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body.price_cop !== undefined) {
    const price = Math.round(Number(body.price_cop));
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: "Precio no válido." }, { status: 400 });
    }
    update.price_cop = price;
  }
  if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
  if (typeof body.description === "string" && body.description.trim()) update.description = body.description.trim();
  if (typeof body.active === "boolean") update.active = body.active;

  const { error } = await supabase.from("service_modules").update(update).eq("code", body.code);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
