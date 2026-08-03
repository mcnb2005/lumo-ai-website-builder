import { ensureDatabase, getD1 } from "../../../../../db";
import {
  GOOGLE_STATE_COOKIE,
  createOpaqueToken,
  getGoogleOAuthConfig,
  hashOpaqueToken,
  isSecureRequest,
  safeRelativeReturnPath,
  serializeCookie,
  googleSignInPath,
} from "../../../../google-auth";
import { getCurrentDatabaseUser } from "../../../../server-user";

const STATE_TTL_SECONDS = 10 * 60;

export async function GET(request: Request) {
  try {
    const { clientId, redirectUri } = getGoogleOAuthConfig(request.url);
    const requestUrl = new URL(request.url);
    const purpose =
      requestUrl.searchParams.get("purpose") === "workspace"
        ? "workspace"
        : "login";
    const returnTo = safeRelativeReturnPath(
      requestUrl.searchParams.get("returnTo")
    );
    const currentUser =
      purpose === "workspace" ? await getCurrentDatabaseUser() : null;
    if (purpose === "workspace" && !currentUser) {
      const resumePath = `${requestUrl.pathname}${requestUrl.search}`;
      return Response.redirect(
        new URL(googleSignInPath(resumePath), request.url),
        302
      );
    }
    const state = createOpaqueToken();
    const stateHash = await hashOpaqueToken(state);
    const expiresAt = new Date(
      Date.now() + STATE_TTL_SECONDS * 1000
    ).toISOString();

    await ensureDatabase();
    const database = getD1();
    await database
      .prepare("DELETE FROM auth_states WHERE expires_at <= ?")
      .bind(new Date().toISOString())
      .run();
    await database
      .prepare(
        `INSERT INTO auth_states
          (id, return_to, purpose, user_id, expires_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(stateHash, returnTo, purpose, currentUser?.id || null, expiresAt)
      .run();

    const authorizationUrl = new URL(
      "https://accounts.google.com/o/oauth2/v2/auth"
    );
    authorizationUrl.searchParams.set("client_id", clientId);
    authorizationUrl.searchParams.set("redirect_uri", redirectUri);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set(
      "scope",
      purpose === "workspace"
        ? [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/calendar.events",
          ].join(" ")
        : "openid email profile"
    );
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set("prompt", "select_account");
    authorizationUrl.searchParams.set("include_granted_scopes", "true");
    if (purpose === "workspace") {
      authorizationUrl.searchParams.set("access_type", "offline");
      authorizationUrl.searchParams.set("prompt", "consent select_account");
    }

    const response = new Response(null, {
      status: 302,
      headers: { Location: authorizationUrl.toString() },
    });
    response.headers.append(
      "Set-Cookie",
      serializeCookie(GOOGLE_STATE_COOKIE, state, {
        maxAge: STATE_TTL_SECONDS,
        path: "/api/auth/google/callback",
        secure: isSecureRequest(request),
      })
    );
    return response;
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể bắt đầu đăng nhập Google.",
      },
      { status: 503 }
    );
  }
}
