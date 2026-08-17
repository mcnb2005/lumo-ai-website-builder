import { eq } from "drizzle-orm";
import { ensureDatabase, getD1, getDb } from "../../../../../db";
import { users } from "../../../../../db/schema";
import {
  AUTH_SESSION_COOKIE,
  GOOGLE_STATE_COOKIE,
  type GoogleProfile,
  createOpaqueToken,
  encryptGoogleRefreshToken,
  getGoogleOAuthConfig,
  hashOpaqueToken,
  isSecureRequest,
  readCookie,
  redirectHomeWithAuthError,
  safeRelativeReturnPath,
  serializeCookie,
} from "../../../../google-auth";
import { getCurrentDatabaseUser } from "../../../../server-user";
import { sessionUserAgent } from "../../../../server/account-security";

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const state = requestUrl.searchParams.get("state");
  const code = requestUrl.searchParams.get("code");
  const stateCookie = readCookie(
    request.headers.get("cookie"),
    GOOGLE_STATE_COOKIE
  );

  if (!state || !code || !stateCookie || state !== stateCookie) {
    return redirectHomeWithAuthError(
      request,
      "Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn."
    );
  }

  try {
    await ensureDatabase();
    const database = getD1();
    const stateHash = await hashOpaqueToken(state);
    const authState = await database
      .prepare(
        `SELECT return_to, purpose, user_id, expires_at
         FROM auth_states WHERE id = ? LIMIT 1`
      )
      .bind(stateHash)
      .first<{
        return_to: string;
        purpose: string;
        user_id: string | null;
        expires_at: string;
      }>();
    await database
      .prepare("DELETE FROM auth_states WHERE id = ?")
      .bind(stateHash)
      .run();

    if (!authState || authState.expires_at <= new Date().toISOString()) {
      throw new Error("Yêu cầu đăng nhập đã hết hạn. Hãy thử lại.");
    }

    const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig(
      request.url
    );
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenPayload = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      scope?: string;
      error_description?: string;
    };
    if (!tokenResponse.ok || !tokenPayload.access_token) {
      throw new Error(
        tokenPayload.error_description || "Google không cấp quyền đăng nhập."
      );
    }

    const profileResponse = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: {
          Authorization: `Bearer ${tokenPayload.access_token}`,
        },
      }
    );
    const profile = (await profileResponse.json()) as GoogleProfile;
    if (
      !profileResponse.ok ||
      !profile.sub ||
      !profile.email ||
      profile.email_verified !== true
    ) {
      throw new Error("Google chưa xác minh địa chỉ email của tài khoản.");
    }

    if (authState.purpose === "workspace") {
      const currentUser = await getCurrentDatabaseUser();
      if (!currentUser || currentUser.id !== authState.user_id) {
        throw new Error(
          "Tài khoản Lumo hiện tại không khớp với yêu cầu kết nối Google."
        );
      }
      if (!tokenPayload.refresh_token) {
        throw new Error(
          "Google chưa cấp quyền sử dụng lâu dài. Hãy kết nối lại và chọn Cho phép."
        );
      }
      const encrypted = await encryptGoogleRefreshToken(
        tokenPayload.refresh_token
      );
      const now = new Date().toISOString();
      await database
        .prepare(
          `INSERT INTO google_connections
            (user_id, encrypted_refresh_token, token_iv, connected_email, scopes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET
             encrypted_refresh_token = excluded.encrypted_refresh_token,
             token_iv = excluded.token_iv,
             connected_email = excluded.connected_email,
             scopes = excluded.scopes,
             updated_at = excluded.updated_at`
        )
        .bind(
          currentUser.id,
          encrypted.encryptedRefreshToken,
          encrypted.tokenIv,
          profile.email.trim().toLowerCase(),
          tokenPayload.scope || "",
          now,
          now
        )
        .run();

      const destination = new URL(
        safeRelativeReturnPath(authState.return_to),
        request.url
      );
      destination.searchParams.set("googleConnected", "1");
      const response = new Response(null, {
        status: 302,
        headers: { Location: destination.toString() },
      });
      response.headers.append(
        "Set-Cookie",
        serializeCookie(GOOGLE_STATE_COOKIE, "", {
          maxAge: 0,
          path: "/api/auth/google/callback",
          secure: isSecureRequest(request),
        })
      );
      return response;
    }

    const db = getDb();
    const email = profile.email.trim().toLowerCase();
    const [existingBySubject] = await db
      .select()
      .from(users)
      .where(eq(users.googleSub, profile.sub))
      .limit(1);
    const [existingByEmail] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (
      existingByEmail?.googleSub &&
      existingByEmail.googleSub !== profile.sub
    ) {
      throw new Error("Email này đã được liên kết với một tài khoản Google khác.");
    }
    if (
      existingBySubject &&
      existingByEmail &&
      existingBySubject.id !== existingByEmail.id
    ) {
      throw new Error(
        "Email Google này đang thuộc về một tài khoản Lumo khác."
      );
    }

    const currentUser = existingBySubject || existingByEmail;
    if (currentUser?.deletedAt) {
      throw new Error("Tài khoản này đã bị xóa.");
    }
    const userId = currentUser?.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const name = profile.name?.trim() || email;
    if (currentUser) {
      await db
        .update(users)
        .set({
          email,
          name,
          googleSub: profile.sub,
          avatarUrl: profile.picture || null,
          updatedAt: now,
        })
        .where(eq(users.id, currentUser.id));
    } else {
      await db.insert(users).values({
        id: userId,
        email,
        name,
        googleSub: profile.sub,
        avatarUrl: profile.picture || null,
        updatedAt: now,
      });
    }

    const sessionToken = createOpaqueToken();
    const sessionHash = await hashOpaqueToken(sessionToken);
    const sessionExpiresAt = new Date(
      Date.now() + SESSION_TTL_SECONDS * 1000
    ).toISOString();
    await database
      .prepare("DELETE FROM auth_sessions WHERE expires_at <= ?")
      .bind(now)
      .run();
    await database
      .prepare(
        `INSERT INTO auth_sessions
          (id, user_id, expires_at, user_agent, last_seen_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(
        sessionHash,
        userId,
        sessionExpiresAt,
        sessionUserAgent(request),
        now
      )
      .run();

    const destination = new URL(
      safeRelativeReturnPath(authState.return_to),
      request.url
    );
    const response = new Response(null, {
      status: 302,
      headers: { Location: destination.toString() },
    });
    response.headers.append(
      "Set-Cookie",
      serializeCookie(AUTH_SESSION_COOKIE, sessionToken, {
        maxAge: SESSION_TTL_SECONDS,
        secure: isSecureRequest(request),
      })
    );
    response.headers.append(
      "Set-Cookie",
      serializeCookie(GOOGLE_STATE_COOKIE, "", {
        maxAge: 0,
        path: "/api/auth/google/callback",
        secure: isSecureRequest(request),
      })
    );
    return response;
  } catch (error) {
    return redirectHomeWithAuthError(
      request,
      error instanceof Error ? error.message : "Không thể đăng nhập Google."
    );
  }
}
