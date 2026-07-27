import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships a durable customer management dashboard", async () => {
  const [dashboard, page, api, schema, database, studio] = await Promise.all([
    readFile(new URL("../app/dashboard/LeadDashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/leads/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/Studio.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /requireChatGPTUser/);
  assert.match(dashboard, /Quản lý liên hệ/);
  assert.match(dashboard, /Xuất CSV/);
  assert.match(dashboard, /Ghi chú chăm sóc/);
  assert.match(dashboard, /Đã chốt/);
  assert.match(dashboard, /method: "PATCH"/);
  assert.match(api, /export async function PATCH/);
  assert.match(api, /projects\.ownerId/);
  assert.match(schema, /status: text\("status"\)/);
  assert.match(schema, /notes: text\("notes"\)/);
  assert.match(database, /ALTER TABLE leads ADD COLUMN status/);
  assert.match(studio, /\/dashboard\?projectId=/);
});
