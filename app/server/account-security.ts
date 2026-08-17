import { ensureDatabase, getD1 } from "../../db";
import {
  createOpaqueToken,
  hashOpaqueToken,
} from "../google-auth";
import { hashPassword, isAcceptablePassword } from "../password-auth";
import { sendSmtpEmail } from "./smtp-email";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const RESET_TOKEN_MS = 30 * 60 * 1000;
const RESET_MAX_REQUESTS = 3;

function clientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  ).slice(0, 128);
}

async function loginAttemptKey(request: Request, identifier: string) {
  return hashOpaqueToken(
    `password-login:${identifier.trim().toLowerCase()}:${clientIp(request)}`
  );
}

async function allowPasswordResetRequest(
  request: Request,
  identifier: string
) {
  const key = await hashOpaqueToken(
    `password-reset:${identifier}:${clientIp(request)}`
  );
  const now = new Date();
  const row = await getD1()
    .prepare(
      `SELECT attempt_count, window_started_at, locked_until
       FROM auth_login_attempts WHERE key = ? LIMIT 1`
    )
    .bind(key)
    .first<{
      attempt_count: number;
      window_started_at: string;
      locked_until: string | null;
    }>();
  const lockedUntil = row?.locked_until
    ? new Date(row.locked_until).getTime()
    : 0;
  if (lockedUntil > now.getTime()) return false;
  const priorWindow = row ? new Date(row.window_started_at).getTime() : 0;
  const sameWindow =
    Number.isFinite(priorWindow) && now.getTime() - priorWindow < LOGIN_WINDOW_MS;
  const attemptCount = sameWindow ? row!.attempt_count + 1 : 1;
  const windowStartedAt = sameWindow
    ? row!.window_started_at
    : now.toISOString();
  const nextLockedUntil =
    attemptCount >= RESET_MAX_REQUESTS
      ? new Date(now.getTime() + LOGIN_WINDOW_MS).toISOString()
      : null;
  await getD1()
    .prepare(
      `INSERT INTO auth_login_attempts
        (key, attempt_count, window_started_at, locked_until, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         attempt_count = excluded.attempt_count,
         window_started_at = excluded.window_started_at,
         locked_until = excluded.locked_until,
         updated_at = excluded.updated_at`
    )
    .bind(
      key,
      attemptCount,
      windowStartedAt,
      nextLockedUntil,
      now.toISOString()
    )
    .run();
  return true;
}

export async function loginRetryAfter(
  request: Request,
  identifier: string
) {
  await ensureDatabase();
  const key = await loginAttemptKey(request, identifier);
  const nowMs = Date.now();
  const row = await getD1()
    .prepare(
      `SELECT attempt_count, window_started_at, locked_until
       FROM auth_login_attempts WHERE key = ? LIMIT 1`
    )
    .bind(key)
    .first<{
      attempt_count: number;
      window_started_at: string;
      locked_until: string | null;
    }>();
  if (!row) return 0;
  const lockedUntil = row.locked_until
    ? new Date(row.locked_until).getTime()
    : 0;
  if (lockedUntil > nowMs) {
    return Math.max(1, Math.ceil((lockedUntil - nowMs) / 1000));
  }
  const windowStarted = new Date(row.window_started_at).getTime();
  if (!Number.isFinite(windowStarted) || nowMs - windowStarted >= LOGIN_WINDOW_MS) {
    await getD1()
      .prepare("DELETE FROM auth_login_attempts WHERE key = ?")
      .bind(key)
      .run();
  }
  return 0;
}

export async function recordLoginFailure(
  request: Request,
  identifier: string
) {
  const key = await loginAttemptKey(request, identifier);
  const now = new Date();
  const row = await getD1()
    .prepare(
      `SELECT attempt_count, window_started_at
       FROM auth_login_attempts WHERE key = ? LIMIT 1`
    )
    .bind(key)
    .first<{ attempt_count: number; window_started_at: string }>();
  const priorWindow = row ? new Date(row.window_started_at).getTime() : 0;
  const sameWindow =
    Number.isFinite(priorWindow) && now.getTime() - priorWindow < LOGIN_WINDOW_MS;
  const attemptCount = sameWindow ? row!.attempt_count + 1 : 1;
  const windowStartedAt = sameWindow
    ? row!.window_started_at
    : now.toISOString();
  const lockedUntil =
    attemptCount >= LOGIN_MAX_FAILURES
      ? new Date(now.getTime() + LOGIN_LOCK_MS).toISOString()
      : null;
  await getD1()
    .prepare(
      `INSERT INTO auth_login_attempts
        (key, attempt_count, window_started_at, locked_until, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         attempt_count = excluded.attempt_count,
         window_started_at = excluded.window_started_at,
         locked_until = excluded.locked_until,
         updated_at = excluded.updated_at`
    )
    .bind(
      key,
      attemptCount,
      windowStartedAt,
      lockedUntil,
      now.toISOString()
    )
    .run();
  return lockedUntil ? LOGIN_LOCK_MS / 1000 : 0;
}

export async function clearLoginFailures(
  request: Request,
  identifier: string
) {
  const key = await loginAttemptKey(request, identifier);
  await getD1()
    .prepare("DELETE FROM auth_login_attempts WHERE key = ?")
    .bind(key)
    .run();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function requestPasswordReset(
  request: Request,
  identifier: string
) {
  await ensureDatabase();
  const normalized = identifier.trim().toLowerCase().slice(0, 254);
  if (!normalized) return;
  if (!(await allowPasswordResetRequest(request, normalized))) return;
  const user = await getD1()
    .prepare(
      `SELECT id, email, name, password_hash
       FROM users
       WHERE deleted_at IS NULL
         AND (lower(email) = ? OR lower(username) = ?)
       LIMIT 1`
    )
    .bind(normalized, normalized)
    .first<{
      id: string;
      email: string;
      name: string | null;
      password_hash: string | null;
    }>();
  if (!user?.password_hash || user.email.endsWith("@lumo.local")) return;

  const token = createOpaqueToken();
  const tokenHash = await hashOpaqueToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + RESET_TOKEN_MS).toISOString();
  await getD1().batch([
    getD1()
      .prepare(
        `UPDATE password_reset_tokens SET used_at = ?
         WHERE user_id = ? AND used_at IS NULL`
      )
      .bind(now.toISOString(), user.id),
    getD1()
      .prepare(
        `INSERT INTO password_reset_tokens
          (id, user_id, expires_at, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .bind(tokenHash, user.id, expiresAt, now.toISOString()),
  ]);

  const resetUrl = new URL("/reset-password", request.url);
  resetUrl.searchParams.set("token", token);
  const name = user.name || "bạn";
  await sendSmtpEmail({
    to: user.email,
    subject: "Đặt lại mật khẩu Lumo",
    text: `Chào ${name},\n\nMở liên kết sau để đặt lại mật khẩu Lumo: ${resetUrl.toString()}\n\nLiên kết có hiệu lực trong 30 phút và chỉ dùng được một lần. Nếu bạn không yêu cầu, hãy bỏ qua email này.`,
    html: `<p>Chào ${escapeHtml(name)},</p><p>Bạn vừa yêu cầu đặt lại mật khẩu Lumo.</p><p><a href="${escapeHtml(resetUrl.toString())}">Đặt lại mật khẩu</a></p><p>Liên kết có hiệu lực trong 30 phút và chỉ dùng được một lần. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`,
  });
}

export async function resetPasswordWithToken(token: string, password: string) {
  await ensureDatabase();
  if (!isAcceptablePassword(password) || password.length > 256) {
    throw new Error("Mật khẩu phải có ít nhất 8 ký tự.");
  }
  const tokenHash = await hashOpaqueToken(token);
  const now = new Date().toISOString();
  const reset = await getD1()
    .prepare(
      `SELECT reset.user_id
       FROM password_reset_tokens reset
       INNER JOIN users user ON user.id = reset.user_id
       WHERE reset.id = ? AND reset.used_at IS NULL
         AND reset.expires_at > ? AND user.deleted_at IS NULL
       LIMIT 1`
    )
    .bind(tokenHash, now)
    .first<{ user_id: string }>();
  if (!reset) {
    throw new Error("Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.");
  }
  const passwordHash = await hashPassword(password);
  await getD1().batch([
    getD1()
      .prepare(
        `UPDATE password_reset_tokens SET used_at = ?
         WHERE id = ? AND used_at IS NULL`
      )
      .bind(now, tokenHash),
    getD1()
      .prepare(
        `UPDATE users
         SET password_hash = ?, must_change_password = 0,
             password_updated_at = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(passwordHash, now, now, reset.user_id),
    getD1()
      .prepare("DELETE FROM auth_sessions WHERE user_id = ?")
      .bind(reset.user_id),
  ]);
}

export function sessionUserAgent(request: Request) {
  return (request.headers.get("user-agent") || "Thiết bị không xác định").slice(
    0,
    500
  );
}
