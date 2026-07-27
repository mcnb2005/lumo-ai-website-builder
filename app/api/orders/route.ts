import { and, desc, eq } from "drizzle-orm";
import { ensureDatabase, getDb, getRuntimeEnv } from "../../../db";
import { orders, projects } from "../../../db/schema";
import { inferDashboardType } from "../../dashboard-config";
import { getCurrentDatabaseUser } from "../../server-user";

const workflowStatuses = [
  "new",
  "contacted",
  "qualified",
  "won",
  "lost",
] as const;

type WorkflowStatus = (typeof workflowStatuses)[number];

function isWorkflowStatus(value: unknown): value is WorkflowStatus {
  return (
    typeof value === "string" &&
    workflowStatuses.includes(value as WorkflowStatus)
  );
}

function sanitizeValues(values: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(values)
      .slice(0, 12)
      .map(([key, value]) => [
        key.slice(0, 80),
        String(value).trim().slice(0, 2000),
      ])
  );
}

function findValue(values: Record<string, string>, patterns: string[]) {
  const entry = Object.entries(values).find(([key]) =>
    patterns.some((pattern) => key.toLowerCase().includes(pattern))
  );
  return entry?.[1]?.trim() || "";
}

function parseVndPrice(value: unknown) {
  if (typeof value !== "string") return 0;
  const digits = value.replace(/[^\d]/g, "");
  const amount = Number(digits);
  return Number.isSafeInteger(amount) && amount >= 1000 ? amount : 0;
}

function orderProduct(landing: {
  brand?: string;
  pricing?: Array<{
    name?: string;
    price?: string;
    highlighted?: boolean;
  }>;
}) {
  const plans = Array.isArray(landing.pricing) ? landing.pricing : [];
  const plan = plans.find((item) => item.highlighted) || plans[0];
  return {
    name: plan?.name?.trim() || landing.brand?.trim() || "Sản phẩm",
    amount: parseVndPrice(plan?.price),
  };
}

function paymentLabel(status: string) {
  return (
    {
      pending: "Chờ thanh toán",
      awaiting_payment: "Đã mở trang thanh toán",
      paid: "Đã thanh toán",
      failed: "Thanh toán thất bại",
      manual: "Chưa bật thanh toán trực tuyến",
      checkout_error: "Không thể mở trang thanh toán",
    }[status] || status
  );
}

function serializeOrder(row: typeof orders.$inferSelect) {
  const values = JSON.parse(row.payload) as Record<string, string>;
  return {
    id: row.id,
    values: {
      ...values,
      san_pham: row.productName,
      so_tien: new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: row.currency.toUpperCase(),
      }).format(row.amount),
      thanh_toan: paymentLabel(row.paymentStatus),
    },
    status: isWorkflowStatus(row.status) ? row.status : "new",
    paymentStatus: row.paymentStatus,
    notes: row.notes || "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt || row.createdAt,
  };
}

async function createStripeCheckout(input: {
  orderId: string;
  slug: string;
  origin: string;
  productName: string;
  amount: number;
  customerEmail: string;
}) {
  const secretKey = getRuntimeEnv().STRIPE_SECRET_KEY;
  if (!secretKey || !input.amount) return null;

  const body = new URLSearchParams({
    mode: "payment",
    success_url: `${input.origin}/p/${encodeURIComponent(input.slug)}?payment=success&order=${input.orderId}`,
    cancel_url: `${input.origin}/p/${encodeURIComponent(input.slug)}?payment=cancelled&order=${input.orderId}`,
    client_reference_id: input.orderId,
    "metadata[order_id]": input.orderId,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "vnd",
    "line_items[0][price_data][unit_amount]": String(input.amount),
    "line_items[0][price_data][product_data][name]": input.productName,
  });
  if (input.customerEmail) {
    body.set("customer_email", input.customerEmail);
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": input.orderId,
    },
    body,
  });
  const result = (await response.json()) as {
    id?: string;
    url?: string;
    error?: { message?: string };
  };
  if (!response.ok || !result.id || !result.url) {
    throw new Error(result.error?.message || "Stripe không thể tạo thanh toán.");
  }
  return { id: result.id, url: result.url };
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentDatabaseUser();
    if (!user) {
      return Response.json(
        { error: "Đăng nhập để xem đơn hàng." },
        { status: 401 }
      );
    }
    const projectId = new URL(request.url).searchParams.get("projectId");
    if (!projectId) {
      return Response.json({ error: "Thiếu mã dự án." }, { status: 400 });
    }

    await ensureDatabase();
    const db = getDb();
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, user.id)))
      .limit(1);
    if (!project) {
      return Response.json(
        { error: "Bạn không có quyền xem đơn hàng này." },
        { status: 403 }
      );
    }
    const rows = await db
      .select()
      .from(orders)
      .where(eq(orders.projectId, projectId))
      .orderBy(desc(orders.createdAt))
      .limit(500);
    return Response.json({ leads: rows.map(serializeOrder) });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể tải danh sách đơn hàng.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentDatabaseUser();
    if (!user) {
      return Response.json(
        { error: "Đăng nhập để cập nhật đơn hàng." },
        { status: 401 }
      );
    }
    const payload = (await request.json()) as {
      id?: string;
      projectId?: string;
      status?: unknown;
      notes?: unknown;
    };
    const id = payload.id?.trim();
    const projectId = payload.projectId?.trim();
    if (!id || !projectId || !isWorkflowStatus(payload.status)) {
      return Response.json(
        { error: "Thông tin cập nhật chưa hợp lệ." },
        { status: 400 }
      );
    }

    await ensureDatabase();
    const db = getDb();
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.ownerId, user.id)))
      .limit(1);
    if (!project) {
      return Response.json(
        { error: "Bạn không có quyền cập nhật đơn hàng này." },
        { status: 403 }
      );
    }

    const notes =
      typeof payload.notes === "string" ? payload.notes.trim().slice(0, 4000) : "";
    const updatedAt = new Date().toISOString();
    const updated = await db
      .update(orders)
      .set({ status: payload.status, notes, updatedAt })
      .where(and(eq(orders.id, id), eq(orders.projectId, projectId)))
      .returning({ id: orders.id });
    if (!updated.length) {
      return Response.json(
        { error: "Không tìm thấy đơn hàng." },
        { status: 404 }
      );
    }
    return Response.json({
      lead: {
        id,
        status: payload.status,
        notes,
        updatedAt,
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể cập nhật đơn hàng.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      slug?: string;
      values?: Record<string, string>;
    };
    const slug = payload.slug?.trim();
    if (!slug || !payload.values || typeof payload.values !== "object") {
      return Response.json(
        { error: "Thông tin đơn hàng chưa hợp lệ." },
        { status: 400 }
      );
    }
    const safeValues = sanitizeValues(payload.values);
    if (!Object.values(safeValues).some(Boolean)) {
      return Response.json(
        { error: "Hãy nhập thông tin đặt hàng." },
        { status: 400 }
      );
    }

    await ensureDatabase();
    const db = getDb();
    const [project] = await db
      .select({
        id: projects.id,
        status: projects.status,
        data: projects.data,
        dashboardType: projects.dashboardType,
      })
      .from(projects)
      .where(eq(projects.slug, slug))
      .limit(1);
    if (!project || project.status !== "published") {
      return Response.json(
        { error: "Landing page chưa được xuất bản." },
        { status: 404 }
      );
    }
    const landing = JSON.parse(project.data);
    const dashboardType =
      project.dashboardType === "auto"
        ? inferDashboardType(landing)
        : project.dashboardType;
    if (dashboardType !== "orders") {
      return Response.json(
        { error: "Landing page này chưa được cấu hình bán sản phẩm." },
        { status: 400 }
      );
    }

    const product = orderProduct(landing);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const canCheckout = Boolean(
      getRuntimeEnv().STRIPE_SECRET_KEY && product.amount
    );
    await db.insert(orders).values({
      id,
      projectId: project.id,
      payload: JSON.stringify(safeValues),
      productName: product.name,
      amount: product.amount,
      paymentStatus: canCheckout ? "pending" : "manual",
      createdAt: now,
      updatedAt: now,
    });

    if (!canCheckout) {
      return Response.json({
        submitted: true,
        orderId: id,
        message:
          "Đã ghi nhận đơn hàng. Chủ trang sẽ liên hệ để xác nhận thanh toán.",
      });
    }

    try {
      const checkout = await createStripeCheckout({
        orderId: id,
        slug,
        origin: new URL(request.url).origin,
        productName: product.name,
        amount: product.amount,
        customerEmail: findValue(safeValues, ["email", "thu_dien_tu"]),
      });
      if (!checkout) throw new Error("Chưa thể mở thanh toán trực tuyến.");
      await db
        .update(orders)
        .set({
          stripeSessionId: checkout.id,
          paymentStatus: "awaiting_payment",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(orders.id, id));
      return Response.json({
        submitted: true,
        orderId: id,
        checkoutUrl: checkout.url,
      });
    } catch {
      await db
        .update(orders)
        .set({
          paymentStatus: "checkout_error",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(orders.id, id));
      return Response.json({
        submitted: true,
        orderId: id,
        message:
          "Đã lưu đơn hàng nhưng chưa thể mở thanh toán. Chủ trang sẽ liên hệ lại.",
      });
    }
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Không thể tạo đơn hàng.",
      },
      { status: 500 }
    );
  }
}
