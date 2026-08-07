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

    const user = await getD1()
      .prepare(
        `SELECT id, password_hash, must_change_password
         FROM users
         WHERE lower(username) = ? OR lower(email) = ?
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
      return invalidCredentials();
    }

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
        "INSERT INTO auth_sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
      )
      .bind(sessionHash, user.id, sessionExpiresAt)
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
