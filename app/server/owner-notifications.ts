import { ensureDatabase, getD1 } from "../../db";
import { sendSmtpEmail } from "./smtp-email";

export const notificationRecordTypes = ["lead", "order"] as const;
export type NotificationRecordType = (typeof notificationRecordTypes)[number];
export type NotificationDeliveryStatus = "pending" | "sent" | "failed";

export type RecordNotificationSummary = {
  status: NotificationDeliveryStatus;
  recipientEmail: string | null;
  attemptCount: number;
  lastError: string | null;
  lastAttemptAt: string | null;
  sentAt: string | null;
};

type NotificationColumns = {
  notificationStatus?: string | null;
  notificationRecipientEmail?: string | null;
  notificationAttemptCount?: number | null;
  notificationLastError?: string | null;
  notificationLastAttemptAt?: string | null;
  notificationSentAt?: string | null;
};

type RecordContext = {
  projectName: string;
  companyNotificationEmail: string | null;
  companyNotificationEmailVerifiedAt: string | null;
  ownerEmail: string | null;
  companyOwnerEmail: string | null;
  values: Record<string, string>;
  productName: string | null;
  amount: number | null;
  currency: string | null;
};

type NotificationRow = {
  status: string;
  recipient_email: string | null;
  attempt_count: number;
  last_error: string | null;
  last_attempt_at: string | null;
  sent_at: string | null;
};

function isDeliveryStatus(value: unknown): value is NotificationDeliveryStatus {
  return value === "pending" || value === "sent" || value === "failed";
}

export function notificationSummaryFromColumns(
  columns: NotificationColumns
): RecordNotificationSummary | null {
  if (!isDeliveryStatus(columns.notificationStatus)) return null;
  return {
    status: columns.notificationStatus,
    recipientEmail: columns.notificationRecipientEmail || null,
    attemptCount: Number(columns.notificationAttemptCount || 0),
    lastError: columns.notificationLastError || null,
    lastAttemptAt: columns.notificationLastAttemptAt || null,
    sentAt: columns.notificationSentAt || null,
  };
}

function notificationSummaryFromRow(
  row: NotificationRow
): RecordNotificationSummary {
  return {
    status: isDeliveryStatus(row.status) ? row.status : "failed",
    recipientEmail: row.recipient_email,
    attemptCount: Number(row.attempt_count || 0),
    lastError: row.last_error,
    lastAttemptAt: row.last_attempt_at,
    sentAt: row.sent_at,
  };
}

function validRecipient(value: string | null) {
  const email = value?.trim().toLowerCase() || "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email.endsWith("@lumo.local") ? null : email;
}

function parseValues(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .slice(0, 12)
        .map(([key, fieldValue]) => [key, String(fieldValue ?? "")])
    );
  } catch {
    return {};
  }
}

function fieldLabel(value: string) {
  const cleaned = value
    .replace(/_\d+$/, "")
    .replaceAll("_", " ")
    .trim();
  return cleaned.charAt(0).toLocaleUpperCase("vi") + cleaned.slice(1);
}

function formatAmount(amount: number | null, currency: string | null) {
  if (amount === null) return null;
  try {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: (currency || "vnd").toUpperCase(),
    }).format(amount);
  } catch {
    return `${amount} ${(currency || "vnd").toUpperCase()}`;
  }
}

async function loadRecordContext(
  projectId: string,
  recordType: NotificationRecordType,
  recordId: string
): Promise<RecordContext | null> {
  const recordTable = recordType === "order" ? "orders" : "leads";
  const orderFields =
    recordType === "order"
      ? "record.product_name, record.amount, record.currency"
      : "NULL AS product_name, NULL AS amount, NULL AS currency";
  const row = await getD1()
    .prepare(
      `SELECT
        project.name AS project_name,
        company.notification_email AS company_notification_email,
        company.notification_email_verified_at AS company_notification_email_verified_at,
        owner.email AS owner_email,
        company_owner.email AS company_owner_email,
        record.payload,
        ${orderFields}
       FROM ${recordTable} record
       INNER JOIN projects project ON project.id = record.project_id
       LEFT JOIN users owner ON owner.id = project.owner_id
       LEFT JOIN companies company ON company.id = project.company_id
       LEFT JOIN users company_owner ON company_owner.id = company.owner_id
       WHERE record.id = ? AND record.project_id = ?
       LIMIT 1`
    )
    .bind(recordId, projectId)
    .first<{
      project_name: string;
      company_notification_email: string | null;
      company_notification_email_verified_at: string | null;
      owner_email: string | null;
      company_owner_email: string | null;
      payload: string;
      product_name: string | null;
      amount: number | null;
      currency: string | null;
    }>();
  if (!row) return null;
  return {
    projectName: row.project_name,
    companyNotificationEmail: row.company_notification_email,
    companyNotificationEmailVerifiedAt:
      row.company_notification_email_verified_at,
    ownerEmail: row.owner_email,
    companyOwnerEmail: row.company_owner_email,
    values: parseValues(row.payload),
    productName: row.product_name,
    amount: row.amount === null ? null : Number(row.amount),
    currency: row.currency,
  };
}

function emailContent(
  context: RecordContext,
  recordType: NotificationRecordType,
  recordId: string,
  dashboardUrl: string
) {
  const recordLabel = recordType === "order" ? "đơn hàng" : "khách hàng tiềm năng";
  const detailLines = Object.entries(context.values)
    .filter(([, value]) => value.trim())
    .map(([key, value]) => `${fieldLabel(key)}: ${value.trim()}`);
  const productLines =
    recordType === "order"
      ? [
          context.productName ? `Sản phẩm: ${context.productName}` : "",
          formatAmount(context.amount, context.currency)
            ? `Giá trị: ${formatAmount(context.amount, context.currency)}`
            : "",
        ].filter(Boolean)
      : [];
  return {
    subject: `[Lumo] Có ${recordLabel} mới từ ${context.projectName}`,
    text: [
      `Landing page “${context.projectName}” vừa nhận ${recordLabel} mới.`,
      `Mã: ${recordId}`,
      "",
      ...productLines,
      ...detailLines,
      "",
      `Mở dashboard: ${dashboardUrl}`,
    ].join("\r\n"),
  };
}

async function setPendingNotification(
  projectId: string,
  recordType: NotificationRecordType,
  recordId: string,
  recipientEmail: string | null,
  attemptedAt: string
) {
  await getD1()
    .prepare(
      `INSERT INTO record_notifications
       (id, project_id, record_type, record_id, recipient_email, status,
        attempt_count, last_error, last_attempt_at, sent_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', 1, NULL, ?, NULL, ?, ?)
       ON CONFLICT(record_type, record_id) DO UPDATE SET
         project_id = excluded.project_id,
         recipient_email = excluded.recipient_email,
         status = 'pending',
         attempt_count = record_notifications.attempt_count + 1,
         last_error = NULL,
         last_attempt_at = excluded.last_attempt_at,
         sent_at = NULL,
         updated_at = excluded.updated_at`
    )
    .bind(
      crypto.randomUUID(),
      projectId,
      recordType,
      recordId,
      recipientEmail,
      attemptedAt,
      attemptedAt,
      attemptedAt
    )
    .run();
}

async function finishNotification(
  recordType: NotificationRecordType,
  recordId: string,
  status: "sent" | "failed",
  sentAt: string | null,
  lastError: string | null
) {
  const updatedAt = new Date().toISOString();
  await getD1()
    .prepare(
      `UPDATE record_notifications
       SET status = ?, sent_at = ?, last_error = ?, updated_at = ?
       WHERE record_type = ? AND record_id = ?`
    )
    .bind(status, sentAt, lastError?.slice(0, 500) || null, updatedAt, recordType, recordId)
    .run();
}

async function readNotification(
  recordType: NotificationRecordType,
  recordId: string
) {
  const row = await getD1()
    .prepare(
      `SELECT status, recipient_email, attempt_count, last_error,
        last_attempt_at, sent_at
       FROM record_notifications
       WHERE record_type = ? AND record_id = ?
       LIMIT 1`
    )
    .bind(recordType, recordId)
    .first<NotificationRow>();
  if (!row) throw new Error("Không thể lưu trạng thái gửi thông báo.");
  return notificationSummaryFromRow(row);
}

export async function sendOwnerRecordNotification(input: {
  projectId: string;
  recordType: NotificationRecordType;
  recordId: string;
  origin: string;
}) {
  await ensureDatabase();
  const context = await loadRecordContext(
    input.projectId,
    input.recordType,
    input.recordId
  );
  if (!context) throw new Error("Không tìm thấy dữ liệu để gửi thông báo.");

  const recipientEmail =
    (context.companyNotificationEmailVerifiedAt
      ? validRecipient(context.companyNotificationEmail)
      : null) ||
    validRecipient(context.ownerEmail) ||
    validRecipient(context.companyOwnerEmail);
  const attemptedAt = new Date().toISOString();
  await setPendingNotification(
    input.projectId,
    input.recordType,
    input.recordId,
    recipientEmail,
    attemptedAt
  );

  try {
    if (!recipientEmail) {
      throw new Error("Chủ trang chưa có địa chỉ email nhận thông báo hợp lệ.");
    }
    const dashboardUrl = `${input.origin}/dashboard?projectId=${encodeURIComponent(input.projectId)}`;
    const content = emailContent(
      context,
      input.recordType,
      input.recordId,
      dashboardUrl
    );
    const sentAt = await sendSmtpEmail({
      to: recipientEmail,
      subject: content.subject,
      text: content.text,
    });
    if (!sentAt) throw new Error("SMTP chưa được cấu hình.");
    await finishNotification(
      input.recordType,
      input.recordId,
      "sent",
      sentAt,
      null
    );
  } catch (error) {
    await finishNotification(
      input.recordType,
      input.recordId,
      "failed",
      null,
      error instanceof Error ? error.message : "Không thể gửi email thông báo."
    );
  }

  return readNotification(input.recordType, input.recordId);
}
