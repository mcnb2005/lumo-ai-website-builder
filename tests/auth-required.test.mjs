import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("requires login for Studio and AI while keeping published pages public", async () => {
  const [homePage, loginPage, aiApi, publicPage, publicApi, leadsApi] =
    await Promise.all([
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/api/ai/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/p/[slug]/page.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../app/api/public/[slug]/route.ts", import.meta.url),
        "utf8"
      ),
      readFile(new URL("../app/api/leads/route.ts", import.meta.url), "utf8"),
    ]);

  assert.match(homePage, /getCurrentDatabaseUser/);
  assert.match(homePage, /if \(!user\) redirect\("\/login"\)/);
  assert.match(loginPage, /getCurrentDatabaseUser/);
  assert.match(loginPage, /api\/auth\/google\/start\?returnTo=%2F/);
  assert.match(loginPage, /Đăng nhập bằng Google/);

  const authGuardIndex = aiApi.indexOf("if (!user)");
  const parsePayloadIndex = aiApi.indexOf("await request.json()");
  assert.ok(authGuardIndex >= 0, "AI route must reject anonymous users");
  assert.ok(
    authGuardIndex < parsePayloadIndex,
    "AI authentication must run before parsing or processing the prompt"
  );
  assert.match(aiApi, /status: 401/);

  assert.doesNotMatch(publicPage, /requireCurrentDatabaseUser/);
  assert.doesNotMatch(publicApi, /requireCurrentDatabaseUser/);
  assert.match(leadsApi, /export async function POST/);
});
