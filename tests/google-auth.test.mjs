import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships account-specific Google OAuth with server-side sessions", async () => {
  const [
    auth,
    start,
    callback,
    logout,
    integration,
    workflow,
    dashboard,
    serverUser,
    projects,
    environment,
  ] =
    await Promise.all([
      readFile(new URL("../app/google-auth.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../app/api/auth/google/start/route.ts", import.meta.url),
        "utf8"
      ),
      readFile(
        new URL("../app/api/auth/google/callback/route.ts", import.meta.url),
        "utf8"
      ),
      readFile(
        new URL("../app/api/auth/logout/route.ts", import.meta.url),
        "utf8"
      ),
      readFile(
        new URL("../app/api/integrations/google/route.ts", import.meta.url),
        "utf8"
      ),
      readFile(
        new URL("../app/server/google-workflow.ts", import.meta.url),
        "utf8"
      ),
      readFile(
        new URL("../app/dashboard/LeadDashboard.tsx", import.meta.url),
        "utf8"
      ),
      readFile(new URL("../app/server-user.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/projects/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../.env.example", import.meta.url), "utf8"),
    ]);

  assert.match(auth, /lumo_session/);
  assert.match(auth, /HttpOnly/);
  assert.match(auth, /SameSite=Lax/);
  assert.match(start, /accounts\.google\.com\/o\/oauth2\/v2\/auth/);
  assert.match(start, /auth_states/);
  assert.match(callback, /oauth2\.googleapis\.com\/token/);
  assert.match(callback, /openidconnect\.googleapis\.com\/v1\/userinfo/);
  assert.match(callback, /email_verified !== true/);
  assert.match(callback, /auth_sessions/);
  assert.match(callback, /google_connections/);
  assert.match(callback, /encryptGoogleRefreshToken/);
  assert.match(logout, /DELETE FROM auth_sessions/);
  assert.match(integration, /DELETE FROM google_connections/);
  assert.match(integration, /oauth2\.googleapis\.com\/revoke/);
  assert.match(workflow, /WHERE user_id = \?/);
  assert.match(workflow, /decryptGoogleRefreshToken/);
  assert.match(workflow, /sendSmtpEmail/);
  assert.match(workflow, /calendar\/v3\/calendars/);
  assert.match(dashboard, /Kết nối Google Calendar/);
  assert.doesNotMatch(start, /gmail\.send/);
  assert.match(serverUser, /AUTH_SESSION_COOKIE/);
  assert.match(projects, /eq\(projects\.ownerId, user\.id\)/);
  assert.match(environment, /GOOGLE_OAUTH_CLIENT_ID=/);
  assert.match(environment, /GOOGLE_OAUTH_CLIENT_SECRET=/);
  assert.match(environment, /GOOGLE_TOKEN_ENCRYPTION_KEY=/);
  assert.match(environment, /SMTP_HOST=/);
  assert.match(environment, /SMTP_PASSWORD=/);
});
