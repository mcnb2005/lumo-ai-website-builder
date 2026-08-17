import { getD1 } from "../../db";
import { hashOpaqueToken } from "../google-auth";
import { getSmtpStatus, sendSmtpEmail } from "./smtp-email";

const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;
const VERIFICATION_RESEND_DELAY_MS = 60 * 1000;
const MAX_VERIFICATION_ATTEMPTS = 5;

export type CompanyNotificationEmailSettings = {
  email: string | null;
  verifiedAt: string | null;
  pendingEmail: string | null;
  verificationExpiresAt: string | null;
  resendAvailableAt: string | null;
  verificationAttemptCount: number;
};

type VerificationRow = {
  email: string;
  code_hash: string;
  attempt_count: number;
  expires_at: string;
  last_sent_at: string;
};

export class CompanyNotificationEmailError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

export function normalizeCompanyNotificationEmail(value: unknown) {
  if (typeof value !== "string") {
    throw new CompanyNotificationEmailError(
      "Hãy nhập địa chỉ email nhận thông báo.",
      400
    );
  }
  const email = value.trim().toLowerCase();
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.endsWith("@lumo.local")
  ) {
    throw new CompanyNotificationEmailError(
      "Hãy nhập một địa chỉ email thật và hợp lệ.",
      400
    );
  }
  return email;
}

function generateVerificationCode() {
  const range = 1_000_000;
  const limit = Math.floor(0x1_0000_0000 / range) * range;
  const random = new Uint32Array(1);
  do {
    crypto.getRandomValues(random);
  } while (random[0] >= limit);
  return String(random[0] % range).padStart(6, "0");
}

function codeHash(companyId: string, email: string, code: string) {
  return hashOpaqueToken(`${companyId}:${email}:${code}`);
}

function addMilliseconds(value: string, milliseconds: number) {
  const timestamp = new Date(value).getTime();
  return new Date(timestamp + milliseconds).toISOString();
}

export async function readCompanyNotificationEmailSettings(
  companyId: string
): Promise<CompanyNotificationEmailSettings> {
  const row = await getD1()
    .prepare(
      `SELECT
        company.notification_email,
        company.notification_email_verified_at,
        verification.email AS pending_email,
        verification.attempt_count,
        verification.expires_at,
        verification.last_sent_at
       FROM companies company
       LEFT JOIN company_notification_email_verifications verification
         ON verification.company_id = company.id
       WHERE company.id = ?
       LIMIT 1`
    )
    .bind(companyId)
    .first<{
      notification_email: string | null;
      notification_email_verified_at: string | null;
      pending_email: string | null;
      attempt_count: number | null;
      expires_at: string | null;
      last_sent_at: string | null;
    }>();
  if (!row) {
    throw new CompanyNotificationEmailError("Không tìm thấy công ty.", 404);
  }
  const hasActiveVerification = Boolean(
    row.pending_email &&
      row.expires_at &&
      row.expires_at > new Date().toISOString()
  );
  return {
    email: row.notification_email,
    verifiedAt: row.notification_email_verified_at,
    pendingEmail: hasActiveVerification ? row.pending_email : null,
    verificationExpiresAt: hasActiveVerification ? row.expires_at : null,
    resendAvailableAt:
      hasActiveVerification && row.last_sent_at
        ? addMilliseconds(row.last_sent_at, VERIFICATION_RESEND_DELAY_MS)
        : null,
    verificationAttemptCount: hasActiveVerification
      ? Number(row.attempt_count || 0)
      : 0,
  };
}

export async function requestCompanyNotificationEmailVerification(input: {
  companyId: string;
  userId: string;
  email: unknown;
}) {
  const email = normalizeCompanyNotificationEmail(input.email);
  let smtpConfigured = false;
  try {
    smtpConfigured = getSmtpStatus().configured;
  } catch (error) {
    throw new CompanyNotificationEmailError(
      error instanceof Error ? error.message : "Cấu hình SMTP không hợp lệ.",
      503
    );
  }
  if (!smtpConfigured) {
    throw new CompanyNotificationEmailError(
      "SMTP chưa được cấu hình nên chưa thể gửi mã xác minh.",
      503
    );
  }

  const existing = await getD1()
    .prepare(
      `SELECT last_sent_at
       FROM company_notification_email_verifications
       WHERE company_id = ?
       LIMIT 1`
    )
    .bind(input.companyId)
    .first<{ last_sent_at: string }>();
  if (existing?.last_sent_at) {
    const resendAt =
      new Date(existing.last_sent_at).getTime() + VERIFICATION_RESEND_DELAY_MS;
    const remainingSeconds = Math.ceil((resendAt - Date.now()) / 1000);
    if (remainingSeconds > 0) {
      throw new CompanyNotificationEmailError(
        `Hãy chờ ${remainingSeconds} giây trước khi gửi lại mã.`,
        429
      );
    }
  }

  const code = generateVerificationCode();
  const hash = await codeHash(input.companyId, email, code);
  const now = new Date().toISOString();
  const expiresAt = new Date(
    Date.now() + VERIFICATION_CODE_TTL_MS
  ).toISOString();
  await getD1()
    .prepare(
      `INSERT INTO company_notification_email_verifications
       (company_id, email, code_hash, attempt_count, expires_at, last_sent_at,
        requested_by, created_at, updated_at)
       VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)
       ON CONFLICT(company_id) DO UPDATE SET
         email = excluded.email,
         code_hash = excluded.code_hash,
         attempt_count = 0,
         expires_at = excluded.expires_at,
         last_sent_at = excluded.last_sent_at,
         requested_by = excluded.requested_by,
         updated_at = excluded.updated_at`
    )
    .bind(
      input.companyId,
      email,
      hash,
      expiresAt,
      now,
      input.userId,
      now,
      now
    )
    .run();

  try {
    const sentAt = await sendSmtpEmail({
      to: email,
      subject: "Mã xác minh email nhận thông báo từ Lumo",
      text: [
        "Bạn đang thiết lập email nhận thông báo khách hàng cho công ty trên Lumo.",
        "",
        `Mã xác minh: ${code}`,
        "",
        "Mã có hiệu lực trong 10 phút. Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.",
      ].join("\r\n"),
    });
    if (!sentAt) {
      throw new Error("SMTP chưa được cấu hình.");
    }
  } catch (error) {
    await getD1()
      .prepare(
        `DELETE FROM company_notification_email_verifications
         WHERE company_id = ? AND code_hash = ?`
      )
      .bind(input.companyId, hash)
      .run();
    throw new CompanyNotificationEmailError(
      error instanceof Error ? error.message : "Không thể gửi mã xác minh.",
      502
    );
  }

  return readCompanyNotificationEmailSettings(input.companyId);
}

export async function verifyCompanyNotificationEmail(input: {
  companyId: string;
  code: unknown;
}) {
  const code = typeof input.code === "string" ? input.code.trim() : "";
  if (!/^\d{6}$/.test(code)) {
    throw new CompanyNotificationEmailError("Mã xác minh phải gồm 6 chữ số.");
  }
  const row = await getD1()
    .prepare(
      `SELECT email, code_hash, attempt_count, expires_at, last_sent_at
       FROM company_notification_email_verifications
       WHERE company_id = ?
       LIMIT 1`
    )
    .bind(input.companyId)
    .first<VerificationRow>();
  if (!row) {
    throw new CompanyNotificationEmailError(
      "Chưa có yêu cầu xác minh email đang hoạt động.",
      404
    );
  }
  const now = new Date().toISOString();
  if (row.expires_at <= now) {
    await getD1()
      .prepare(
        "DELETE FROM company_notification_email_verifications WHERE company_id = ?"
      )
      .bind(input.companyId)
      .run();
    throw new CompanyNotificationEmailError(
      "Mã xác minh đã hết hạn. Hãy yêu cầu mã mới.",
      410
    );
  }
  if (Number(row.attempt_count) >= MAX_VERIFICATION_ATTEMPTS) {
    throw new CompanyNotificationEmailError(
      "Bạn đã nhập sai quá nhiều lần. Hãy yêu cầu mã mới.",
      429
    );
  }
  const hash = await codeHash(input.companyId, row.email, code);
  if (hash !== row.code_hash) {
    const attemptCount = Number(row.attempt_count) + 1;
    await getD1()
      .prepare(
        `UPDATE company_notification_email_verifications
         SET attempt_count = ?, updated_at = ?
         WHERE company_id = ?`
      )
      .bind(attemptCount, now, input.companyId)
      .run();
    const attemptsRemaining = Math.max(
      0,
      MAX_VERIFICATION_ATTEMPTS - attemptCount
    );
    throw new CompanyNotificationEmailError(
      attemptsRemaining
        ? `Mã chưa đúng. Bạn còn ${attemptsRemaining} lần thử.`
        : "Bạn đã nhập sai quá nhiều lần. Hãy yêu cầu mã mới.",
      attemptsRemaining ? 400 : 429
    );
  }

  await getD1().batch([
    getD1()
      .prepare(
        `UPDATE companies
         SET notification_email = ?, notification_email_verified_at = ?,
             updated_at = ?
         WHERE id = ?`
      )
      .bind(row.email, now, now, input.companyId),
    getD1()
      .prepare(
        "DELETE FROM company_notification_email_verifications WHERE company_id = ?"
      )
      .bind(input.companyId),
  ]);
  return readCompanyNotificationEmailSettings(input.companyId);
}

export async function sendCompanyNotificationEmailTest(companyId: string) {
  const settings = await readCompanyNotificationEmailSettings(companyId);
  if (!settings.email || !settings.verifiedAt) {
    throw new CompanyNotificationEmailError(
      "Hãy xác minh email nhận thông báo trước khi gửi thử.",
      409
    );
  }
  let sentAt: string | null;
  try {
    sentAt = await sendSmtpEmail({
      to: settings.email,
      subject: "Email thông báo từ Lumo đã hoạt động",
      text: [
        "Email nhận thông báo của công ty đã được cấu hình thành công.",
        "",
        "Khi landing page có khách hàng tiềm năng hoặc đơn hàng mới, Lumo sẽ gửi thông tin tới địa chỉ này.",
      ].join("\r\n"),
    });
  } catch (error) {
    throw new CompanyNotificationEmailError(
      error instanceof Error ? error.message : "Không thể gửi email thử.",
      502
    );
  }
  if (!sentAt) {
    throw new CompanyNotificationEmailError(
      "SMTP chưa được cấu hình nên không thể gửi email thử.",
      503
    );
  }
  return { sentAt, settings };
}
