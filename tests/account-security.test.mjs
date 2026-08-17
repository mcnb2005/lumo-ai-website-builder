import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships password recovery, login throttling, session control and account privacy tools", async () => {
  const [
    schema,
    security,
    login,
    forgot,
    reset,
    sessions,
    accountApi,
    exportApi,
    accountPage,
    accountDashboard,
    serverUser,
  ] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/server/account-security.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/password/login/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/password/forgot/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/password/reset/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/account/sessions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/account/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/account/export/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/account/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/account/AccountDashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/server-user.ts", import.meta.url), "utf8"),
  ]);

  assert.match(schema, /export const passwordResetTokens/);
  assert.match(schema, /export const authLoginAttempts/);
  assert.match(schema, /userAgent: text\("user_agent"\)/);
  assert.match(security, /LOGIN_MAX_FAILURES = 5/);
  assert.match(security, /RESET_TOKEN_MS = 30 \* 60 \* 1000/);
  assert.match(security, /RESET_MAX_REQUESTS = 3/);
  assert.match(security, /sendSmtpEmail/);
  assert.match(security, /hashOpaqueToken\(token\)/);
  assert.match(security, /DELETE FROM auth_sessions WHERE user_id = \?/);
  assert.match(login, /loginRetryAfter/);
  assert.match(login, /status: 429/);
  assert.match(login, /deleted_at IS NULL/);
  assert.match(forgot, /GENERIC_MESSAGE/);
  assert.doesNotMatch(forgot, /Không tìm thấy tài khoản/);
  assert.match(reset, /resetPasswordWithToken/);
  assert.match(sessions, /allOthers/);
  assert.match(sessions, /currentRemoved/);
  assert.match(accountApi, /XOA TAI KHOAN/);
  assert.match(accountApi, /Tài khoản đã xóa/);
  assert.match(exportApi, /Content-Disposition/);
  assert.match(exportApi, /Cache-Control/);
  assert.match(accountPage, /requireCurrentDatabaseUser/);
  assert.match(accountDashboard, /Phiên đăng nhập/);
  assert.match(accountDashboard, /Tải file JSON/);
  assert.match(serverUser, /last_seen_at/);
  assert.match(serverUser, /user\.deleted_at IS NULL/);
});
