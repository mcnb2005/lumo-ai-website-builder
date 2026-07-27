import { eq } from "drizzle-orm";
import { ensureDatabase, getDb, getRuntimeEnv } from "../../../../db";
import { orders } from "../../../../db/schema";
import { runPaidOrderWorkflow } from "../../../server/google-workflow";

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string
) {
  const parts = signatureHeader.split(",");
  const timestamp = parts
    .find((part) => part.startsWith("t="))
    ?.slice(2);
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));
  if (!timestamp || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expected = hex(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${timestamp}.${payload}`)
    )
  );
  return signatures.some((signature) => safeEqual(signature, expected));
}

export async function POST(request: Request) {
  const secret = getRuntimeEnv().STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json(
      { error: "Stripe webhook chưa được cấu hình." },
      { status: 503 }
    );
  }

  const rawPayload = await request.text();
  const signature = request.headers.get("stripe-signature") || "";
  if (!(await verifyStripeSignature(rawPayload, signature, secret))) {
    return Response.json(
      { error: "Chữ ký Stripe không hợp lệ." },
      { status: 400 }
    );
  }

  const event = JSON.parse(rawPayload) as {
    type?: string;
    data?: {
      object?: {
        id?: string;
        payment_status?: string;
        metadata?: { order_id?: string };
      };
    };
  };
  const object = event.data?.object;
  const orderId = object?.metadata?.order_id;
  if (!orderId) return Response.json({ received: true });

  await ensureDatabase();
  const db = getDb();
  if (
    event.type === "checkout.session.completed" &&
    object?.payment_status === "paid"
  ) {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!order) return Response.json({ received: true });

    const firstFulfillment = order.paymentStatus !== "paid";
    const now = new Date().toISOString();
    await db
      .update(orders)
      .set({
        status: "qualified",
        paymentStatus: "paid",
        stripeSessionId: object.id || order.stripeSessionId,
        updatedAt: now,
      })
      .where(eq(orders.id, orderId));

    if (firstFulfillment) {
      const workflow = await runPaidOrderWorkflow({
        id: order.id,
        productName: order.productName,
        amount: order.amount,
        currency: order.currency,
        values: JSON.parse(order.payload),
      });
      await db
        .update(orders)
        .set({
          confirmationEmailSentAt:
            order.confirmationEmailSentAt ||
            workflow.confirmationEmailSentAt,
          calendarEventId:
            order.calendarEventId || workflow.calendarEventId,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(orders.id, orderId));
    }
  } else if (
    event.type === "checkout.session.expired" ||
    event.type === "payment_intent.payment_failed"
  ) {
    await db
      .update(orders)
      .set({
        paymentStatus: "failed",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(orders.id, orderId));
  }

  return Response.json({ received: true });
}
