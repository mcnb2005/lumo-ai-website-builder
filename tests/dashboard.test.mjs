import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships a durable customer management dashboard", async () => {
  const [
    dashboard,
    page,
    api,
    projectApi,
    dashboardConfig,
    schema,
    database,
    studio,
    landing,
    ordersApi,
    googleWorkflow,
  ] = await Promise.all([
    readFile(new URL("../app/dashboard/LeadDashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/leads/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/projects/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard-config.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/Studio.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/components/LandingCanvas.tsx", import.meta.url),
      "utf8"
    ),
    readFile(new URL("../app/api/orders/route.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/server/google-workflow.ts", import.meta.url),
      "utf8"
    ),
  ]);

  assert.match(page, /requireChatGPTUser/);
  assert.match(dashboard, /dashboardConfigs/);
  assert.match(dashboard, /updateDashboardType/);
  assert.match(dashboard, /Xuất CSV/);
  assert.match(dashboard, /method: "PATCH"/);
  assert.match(dashboardConfig, /Bán sản phẩm \/ Đơn hàng/);
  assert.match(dashboardConfig, /Quảng bá sự kiện/);
  assert.match(dashboardConfig, /Quản lý lịch hẹn/);
  assert.match(dashboardConfig, /inferDashboardType/);
  assert.match(projectApi, /resolvedDashboardType/);
  assert.match(projectApi, /export async function PATCH/);
  assert.match(api, /export async function PATCH/);
  assert.match(api, /projects\.ownerId/);
  assert.match(api, /datetime\('now', '-2 minutes'\)/);
  assert.match(schema, /status: text\("status"\)/);
  assert.match(schema, /notes: text\("notes"\)/);
  assert.match(schema, /dashboardType: text\("dashboard_type"\)/);
  assert.match(schema, /export const orders/);
  assert.doesNotMatch(schema, /payment_status|stripe_session/);
  assert.match(database, /ALTER TABLE leads ADD COLUMN status/);
  assert.match(database, /ALTER TABLE projects ADD COLUMN dashboard_type/);
  assert.match(database, /ALTER TABLE orders ADD COLUMN confirmation_email_sent_at/);
  assert.match(database, /ALTER TABLE orders ADD COLUMN calendar_event_id/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS orders/);
  assert.match(studio, /\/dashboard\?projectId=/);
  assert.match(landing, /const formElement = event\.currentTarget/);
  assert.match(landing, /formElement\.reset\(\)/);
  assert.match(landing, /submissionType === "orders"/);
  assert.match(ordersApi, /inferDashboardType/);
  assert.match(ordersApi, /runOrderWorkflow/);
  assert.doesNotMatch(ordersApi, /Stripe|checkoutUrl|paymentStatus/);
  assert.match(googleWorkflow, /gmail\.googleapis\.com/);
  assert.match(googleWorkflow, /calendar\/v3\/calendars/);
});
