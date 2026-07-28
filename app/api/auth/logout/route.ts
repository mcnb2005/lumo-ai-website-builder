import { ensureDatabase, getD1 } from "../../../../db";
import {
  AUTH_SESSION_COOKIE,
  hashOpaqueToken,
  isSecureRequest,
  readCookie,
  safeRelativeReturnPath,
  serializeCookie,
} from "../../../google-auth";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const sessionToken = readCookie(
    request.headers.get("cookie"),
    AUTH_SESSION_COOKIE
  );

  if (sessionToken) {
    await ensureDatabase();
    await getD1()
      .prepare("DELETE FROM auth_sessions WHERE id = ?")
      .bind(await hashOpaqueToken(sessionToken))
      .run();
  }

  const returnTo = safeRelativeReturnPath(
    requestUrl.searchParams.get("returnTo")
  );
  const response = Response.redirect(new URL(returnTo, request.url), 302);
  response.headers.append(
    "Set-Cookie",
    serializeCookie(AUTH_SESSION_COOKIE, "", {
      maxAge: 0,
      secure: isSecureRequest(request),
    })
  );
  return response;
}
