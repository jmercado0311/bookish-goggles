import { NextResponse } from "next/server";
import { processWompiTransaction, verifyEventSignature } from "@/lib/billing/wompi";

// Webhook de eventos de Wompi. Configurar en el panel de Wompi como
// "URL de eventos": https://<tu-app>/api/billing/webhook
export async function POST(request: Request) {
  const event = await request.json().catch(() => null);

  if (!event || !verifyEventSignature(event)) {
    return NextResponse.json({ error: "Firma inválida." }, { status: 401 });
  }

  if (event.event !== "transaction.updated") {
    return NextResponse.json({ ignored: true });
  }

  const transactionId = event.data?.transaction?.id;
  if (!transactionId) return NextResponse.json({ error: "Evento sin transacción." }, { status: 400 });

  const result = await processWompiTransaction(String(transactionId));
  // Wompi reintenta si no recibe 200; un pago que no es nuestro no se reintenta.
  return NextResponse.json(result);
}
