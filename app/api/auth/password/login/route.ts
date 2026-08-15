import { ensureDatabase, getD1 } from "../../../../../db";
import {
  AUTH_SESSION_COOKIE,
  createOpaqueToken,
  hashOpaqueToken,
  isSecureRequest,
  safeRelativeReturnPath,
  serializeCookie,
} from "../../../../google-auth";
import { verifyPassword } from "../../../../password-auth";
import {
  clearLoginFailures,
  loginRetryAfter,
  recordLoginFailure,
  sessionUserAgent,
} from "../../../../server/account-security";

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

function invalidCredentials() {
  return Response.json(
    { error: "Tên đăng nhập hoặc mật khẩu chưa đúng." },
    { status: 401 }
  );
}

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const payload = (await request.json()) as {
      identifier?: string;
      email?: string;
      password?: string;
      returnTo?: string;
    };
    const identifier = (payload.identifier || payload.email || "")
      .trim()
      .toLowerCase();
    const password = payload.password || "";
    if (!identifier || !password) return invalidCredentials();
    if (identifier.length > 254 || password.length > 512) {
      return invalidCredentials();
    }
    const retryAfter = await loginRetryAfter(request, identifier);
    if (retryAfter) {
      return Response.json(
        {
          error: `Bạn đã thử đăng nhập quá nhiều lần. Hãy thử lại sau ${Math.ceil(
            retryAfter / 60
          )} phút.`,
        },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const user = await getD1()
      .prepare(
        `SELECT id, password_hash, must_change_password
         FROM users
         WHERE deleted_at IS NULL
           AND (lower(username) = ? OR lower(email) = ?)
         LIMIT 1`
      )
      .bind(identifier, identifier)
      .first<{
        id: string;
        password_hash: string | null;
        must_change_password: number;
      }>();
    if (
      !user?.password_hash ||
      !(await verifyPassword(password, user.password_hash))
    ) {
      await recordLoginFailure(request, identifier);
      return invalidCredentials();
    }
    await clearLoginFailures(request, identifier);

    const now = new Date().toISOString();
    const sessionToken = createOpaqueToken();
    const sessionHash = await hashOpaqueToken(sessionToken);
    const sessionExpiresAt = new Date(
      Date.now() + SESSION_TTL_SECONDS * 1000
    ).toISOString();
    await getD1()
      .prepare("DELETE FROM auth_sessions WHERE expires_at <= ?")
      .bind(now)
      .run();
    await getD1()
      .prepare(
        `INSERT INTO auth_sessions
          (id, user_id, expires_at, user_agent, last_seen_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(
        sessionHash,
        user.id,
        sessionExpiresAt,
        sessionUserAgent(request),
        now
      )
      .run();

    const returnTo = safeRelativeReturnPath(payload.returnTo);
    const redirectTo = user.must_change_password
      ? `/account/password?returnTo=${encodeURIComponent(returnTo)}`
      : returnTo;
    const response = Response.json({
      ok: true,
      redirectTo,
      mustChangePassword: Boolean(user.must_change_password),
    });
    response.headers.append(
      "Set-Cookie",
      serializeCookie(AUTH_SESSION_COOKIE, sessionToken, {
        maxAge: SESSION_TTL_SECONDS,
        secure: isSecureRequest(request),
      })
    );
    return response;
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Không thể đăng nhập.",
      },
      { status: 500 }
    );
  }
}
