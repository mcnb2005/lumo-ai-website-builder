import { ensureDatabase, getD1, getRuntimeEnv } from "../../db";
import { decryptGoogleRefreshToken } from "../google-auth";
import { sendSmtpEmail } from "./smtp-email";

type OrderRecord = {
  id: string;
  productName: string;
  amount: number;
  currency: string;
  values: Record<string, string>;
};

export type WorkflowResult = {
  confirmationEmailSentAt: string | null;
  calendarEventId: string | null;
};

function findValue(values: Record<string, string>, patterns: string[]) {
  const entry = Object.entries(values).find(([key]) =>
    patterns.some((pattern) => key.toLowerCase().includes(pattern))
  );
  return entry?.[1]?.trim() || "";
}

function parseDeliveryTime(value: string) {
  const trimmed = value.trim();
  const vietnamese = trimmed.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/
  );
  if (vietnamese) {
    const [, day, month, year, hour = "9", minute = "0"] = vietnamese;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute)
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const isoLike = trimmed.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2}))?$/
  );
  if (isoLike) {
    const [, year, month, day, hour = "9", minute = "0"] = isoLike;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute)
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function getGoogleAccessToken(ownerId: string) {
  const env = getRuntimeEnv();
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID || env.GOOGLE_CLIENT_ID;
  const clientSecret =
    env.GOOGLE_OAUTH_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return null;
  }

  await ensureDatabase();
  const connection = await getD1()
    .prepare(
      `SELECT encrypted_refresh_token, token_iv, connected_email
       FROM google_connections WHERE user_id = ? LIMIT 1`
    )
    .bind(ownerId)
    .first<{
      encrypted_refresh_token: string;
      token_iv: string;
      connected_email: string;
    }>();
  if (!connection) return null;
  const refreshToken = await decryptGoogleRefreshToken(
    connection.encrypted_refresh_token,
    connection.token_iv
  );

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) {
    throw new Error("Không thể xác thực dịch vụ Google.");
  }
  const result = (await response.json()) as { access_token?: string };
  if (!result.access_token) {
    throw new Error("Google không trả về access token.");
  }
  return {
    accessToken: result.access_token,
  };
}

async function sendConfirmationEmail(order: OrderRecord) {
  const recipient = findValue(order.values, ["email", "thu_dien_tu"]);
  if (!recipient) return null;

  const customerName =
    findValue(order.values, ["ho_va_ten", "ho_ten", "full_name", "name"]) ||
    "Quý khách";
  const amount = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: order.currency.toUpperCase(),
  }).format(order.amount);
  const subject = `Xác nhận đơn hàng ${order.id.slice(0, 8)}`;
  const body = [
    `Xin chào ${customerName},`,
    "",
    "Đơn hàng của bạn đã được ghi nhận.",
    `Sản phẩm: ${order.productName}`,
    `Số tiền: ${amount}`,
    `Mã đơn: ${order.id}`,
    "",
    "Chúng tôi sẽ liên hệ nếu cần thêm thông tin giao hàng.",
  ].join("\r\n");
  return sendSmtpEmail({ to: recipient, subject, text: body });
}

async function createDeliveryEvent(
  accessToken: string,
  order: OrderRecord
) {
  const env = getRuntimeEnv();
  const requestedTime = findValue(order.values, [
    "ngay_gio",
    "ngay_giao",
    "delivery",
    "delivery_time",
    "lich_giao",
    "thoi_gian",
    "thoi_gian_giao",
    "scheduled_at",
    "time",
  ]);
  const start = requestedTime ? parseDeliveryTime(requestedTime) : null;
  if (!start) return null;

  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const customerName =
    findValue(order.values, ["ho_va_ten", "ho_ten", "full_name", "name"]) ||
    "Khách hàng";
  const phone = findValue(order.values, [
    "so_dien_thoai",
    "dien_thoai",
    "phone",
    "sdt",
  ]);
  const calendarId = encodeURIComponent(env.GOOGLE_CALENDAR_ID || "primary");
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: `Giao ${order.productName} — ${customerName}`,
        description: `Mã đơn: ${order.id}\nĐiện thoại: ${phone || "Chưa có"}`,
        start: {
          dateTime: start.toISOString(),
          timeZone: "Asia/Bangkok",
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: "Asia/Bangkok",
        },
      }),
    }
  );
  if (!response.ok) {
    throw new Error("Không thể tạo lịch giao hàng.");
  }
  const result = (await response.json()) as { id?: string };
  return result.id || null;
}

export async function runOrderWorkflow(
  order: OrderRecord,
  ownerId: string
): Promise<WorkflowResult> {
  const confirmationEmailSentAt = await sendConfirmationEmail(order).catch(
    () => null
  );
  const googleConnection = await getGoogleAccessToken(ownerId).catch(() => null);
  const calendarEventId = googleConnection
    ? await createDeliveryEvent(googleConnection.accessToken, order).catch(
        () => null
      )
    : null;
  return { confirmationEmailSentAt, calendarEventId };
}
