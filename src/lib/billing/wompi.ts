import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Integración con Wompi (Bancolombia) por Web Checkout:
 * https://docs.wompi.co/docs/colombia/widget-checkout-web/
 *
 * Flujo:
 * 1. El servidor crea un pago PENDING con una referencia única y arma la URL
 *    del checkout firmada con la "llave de integridad".
 * 2. El cliente paga en Wompi (PSE, Nequi, tarjeta, Bancolombia).
 * 3. Wompi avisa al webhook /api/billing/webhook y además redirige al
 *    usuario a /facturacion?id=<transacción>. En ambos casos el servidor
 *    consulta la transacción directamente al API de Wompi (fuente confiable)
 *    y, si quedó APPROVED con el monto exacto, extiende la vigencia del módulo.
 */

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

function apiBaseUrl() {
  return process.env.WOMPI_PUBLIC_KEY?.startsWith("pub_prod_")
    ? "https://production.wompi.co/v1"
    : "https://sandbox.wompi.co/v1";
}

export function wompiConfigured() {
  return Boolean(process.env.WOMPI_PUBLIC_KEY && process.env.WOMPI_INTEGRITY_SECRET);
}

export function buildCheckoutUrl(params: {
  reference: string;
  amountInCents: number;
  redirectUrl: string;
  customerEmail?: string;
}) {
  const currency = "COP";
  const signature = sha256(
    `${params.reference}${params.amountInCents}${currency}${process.env.WOMPI_INTEGRITY_SECRET}`
  );

  const query = new URLSearchParams({
    "public-key": process.env.WOMPI_PUBLIC_KEY!,
    currency,
    "amount-in-cents": String(params.amountInCents),
    reference: params.reference,
    "signature:integrity": signature,
    "redirect-url": params.redirectUrl,
  });
  if (params.customerEmail) query.set("customer-data:email", params.customerEmail);

  return `https://checkout.wompi.co/p/?${query.toString()}`;
}

interface WompiEvent {
  event: string;
  data: Record<string, unknown>;
  signature: { properties: string[]; checksum: string };
  timestamp: number;
}

/** Verifica la firma de un evento de Wompi con el "secreto de eventos". */
export function verifyEventSignature(event: WompiEvent): boolean {
  const secret = process.env.WOMPI_EVENTS_SECRET;
  if (!secret || !event?.signature?.properties || !event.signature.checksum) return false;

  const values = event.signature.properties.map((path) => {
    const value = path
      .split(".")
      .reduce<unknown>(
        (acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined),
        event.data
      );
    return value === undefined || value === null ? "" : String(value);
  });

  const expected = sha256(`${values.join("")}${event.timestamp}${secret}`);
  const received = String(event.signature.checksum).toLowerCase();
  return (
    expected.length === received.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(received))
  );
}

interface WompiTransaction {
  id: string;
  reference: string;
  status: string;
  amount_in_cents: number;
  currency: string;
}

async function fetchTransaction(transactionId: string): Promise<WompiTransaction | null> {
  const res = await fetch(`${apiBaseUrl()}/transactions/${encodeURIComponent(transactionId)}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = await res.json();
  return (body?.data as WompiTransaction) ?? null;
}

/**
 * Consulta la transacción en Wompi y aplica el resultado al pago local.
 * Es idempotente: un pago ya APPROVED no vuelve a extender la vigencia.
 */
export async function processWompiTransaction(transactionId: string) {
  const tx = await fetchTransaction(transactionId);
  if (!tx) return { ok: false as const, reason: "transaccion_no_encontrada" };

  const admin = createAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("*")
    .eq("reference", tx.reference)
    .maybeSingle();

  if (!payment) return { ok: false as const, reason: "pago_no_encontrado" };
  if (payment.status === "APPROVED") return { ok: true as const, status: "APPROVED", payment };

  if (tx.status === "APPROVED") {
    if (tx.currency !== "COP" || Number(tx.amount_in_cents) !== Number(payment.amount_in_cents)) {
      await admin
        .from("payments")
        .update({ status: "ERROR", provider_transaction_id: tx.id, processed_at: new Date().toISOString() })
        .eq("id", payment.id);
      return { ok: false as const, reason: "monto_no_coincide" };
    }

    // Se marca primero como APPROVED solo si seguía PENDING, para que dos
    // llamadas simultáneas (webhook + redirección) no extiendan dos veces.
    const { data: claimed } = await admin
      .from("payments")
      .update({ status: "APPROVED", provider_transaction_id: tx.id, processed_at: new Date().toISOString() })
      .eq("id", payment.id)
      .neq("status", "APPROVED")
      .select()
      .maybeSingle();

    if (claimed) {
      await admin.rpc("extend_subscription", {
        org: payment.organization_id,
        module: payment.module_code,
        months: payment.months,
      });
    }
    return { ok: true as const, status: "APPROVED", payment };
  }

  if (tx.status !== "PENDING") {
    await admin
      .from("payments")
      .update({ status: tx.status, provider_transaction_id: tx.id, processed_at: new Date().toISOString() })
      .eq("id", payment.id)
      .eq("status", "PENDING");
  }
  return { ok: true as const, status: tx.status, payment };
}
