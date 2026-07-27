import { getRuntimeEnv } from "../../db";

type PaidOrder = {
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

function toBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function toBase64Url(value: string) {
  return toBase64(value)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function parseDeliveryTime(value: string) {
  const vietnamese = value.match(
    /(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/
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
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function getGoogleAccessToken() {
  const env = getRuntimeEnv();
  if (
    !env.GOOGLE_CLIENT_ID ||
    !env.GOOGLE_CLIENT_SECRET ||
    !env.GOOGLE_REFRESH_TOKEN
  ) {
    return null;
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
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
  return result.access_token;
}

async function sendConfirmationEmail(
  accessToken: string,
  order: PaidOrder
) {
  const env = getRuntimeEnv();
  const recipient = findValue(order.values, ["email", "thu_dien_tu"]);
  if (!recipient || !env.GMAIL_SENDER_EMAIL) return null;

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
    "Thanh toán của bạn đã được xác nhận.",
    `Sản phẩm: ${order.productName}`,
    `Số tiền: ${amount}`,
    `Mã đơn: ${order.id}`,
    "",
    "Chúng tôi sẽ liên hệ nếu cần thêm thông tin giao hàng.",
  ].join("\r\n");
  const raw = [
    `From: ${env.GMAIL_SENDER_EMAIL}`,
    `To: ${recipient}`,
    `Subject: =?UTF-8?B?${toBase64(subject)}?=`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    body,
  ].join("\r\n");

  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: toBase64Url(raw) }),
    }
  );
  if (!response.ok) {
    throw new Error("Không thể gửi email xác nhận.");
  }
  return new Date().toISOString();
}

async function createDeliveryEvent(
  accessToken: string,
  order: PaidOrder
) {
  const env = getRuntimeEnv();
  const requestedTime = findValue(order.values, [
    "ngay_gio",
    "ngay_giao",
    "delivery",
    "lich_giao",
    "thoi_gian",
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

export async function runPaidOrderWorkflow(
  order: PaidOrder
): Promise<WorkflowResult> {
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) {
    return {
      confirmationEmailSentAt: null,
      calendarEventId: null,
    };
  }

  const confirmationEmailSentAt = await sendConfirmationEmail(
    accessToken,
    order
  ).catch(() => null);
  const calendarEventId = await createDeliveryEvent(
    accessToken,
    order
  ).catch(() => null);
  return { confirmationEmailSentAt, calendarEventId };
}
