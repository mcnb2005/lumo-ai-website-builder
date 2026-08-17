import { ensureDatabase, getD1 } from "../../../../db";
import {
  AUTH_SESSION_COOKIE,
  hashOpaqueToken,
  isSecureRequest,
  readCookie,
  serializeCookie,
} from "../../../google-auth";
import { getCurrentDatabaseUser } from "../../../server-user";

function unauthorized() {
  return Response.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
}

export async function GET(request: Request) {
  await ensureDatabase();
  const user = await getCurrentDatabaseUser();
  if (!user) return unauthorized();
  const token = readCookie(request.headers.get("cookie"), AUTH_SESSION_COOKIE);
  const currentId = token ? await hashOpaqueToken(token) : "";
  const rows = await getD1()
    .prepare(
      `SELECT id, user_agent AS userAgent, last_seen_at AS lastSeenAt,
              created_at AS createdAt, expires_at AS expiresAt
       FROM auth_sessions
       WHERE user_id = ? AND expires_at > ?
       ORDER BY COALESCE(last_seen_at, created_at) DESC`
    )
    .bind(user.id, new Date().toISOString())
    .all<{
      id: string;
      userAgent: string | null;
      lastSeenAt: string | null;
      createdAt: string;
      expiresAt: string;
    }>();
  return Response.json({
    sessions: (rows.results || []).map(({ id, ...session }) => ({
      ...session,
      id,
      isCurrent: id === currentId,
    })),
  });
}

export async function DELETE(request: Request) {
  await ensureDatabase();
  const user = await getCurrentDatabaseUser();
  if (!user) return unauthorized();
  const token = readCookie(request.headers.get("cookie"), AUTH_SESSION_COOKIE);
  const currentId = token ? await hashOpaqueToken(token) : "";
  const payload = (await request.json()) as {
    sessionId?: unknown;
    allOthers?: unknown;
  };
  let currentRemoved = false;
  if (payload.allOthers === true) {
    if (currentId) {
      await getD1()
        .prepare("DELETE FROM auth_sessions WHERE user_id = ? AND id <> ?")
        .bind(user.id, currentId)
        .run();
    } else {
      await getD1()
        .prepare("DELETE FROM auth_sessions WHERE user_id = ?")
        .bind(user.id)
        .run();
    }
  } else if (typeof payload.sessionId === "string" && payload.sessionId) {
    const owned = await getD1()
      .prepare("SELECT id FROM auth_sessions WHERE id = ? AND user_id = ?")
      .bind(payload.sessionId, user.id)
      .first<{ id: string }>();
    if (!owned) {
      return Response.json({ error: "Không tìm thấy phiên đăng nhập." }, { status: 404 });
    }
    await getD1()
      .prepare("DELETE FROM auth_sessions WHERE id = ? AND user_id = ?")
      .bind(payload.sessionId, user.id)
      .run();
    currentRemoved = payload.sessionId === currentId;
  } else {
    return Response.json({ error: "Phiên đăng nhập chưa hợp lệ." }, { status: 400 });
  }
  const response = Response.json({ revoked: true, currentRemoved });
  if (currentRemoved) {
    response.headers.append(
      "Set-Cookie",
      serializeCookie(AUTH_SESSION_COOKIE, "", {
        maxAge: 0,
        secure: isSecureRequest(request),
      })
    );
  }
  return response;
}
