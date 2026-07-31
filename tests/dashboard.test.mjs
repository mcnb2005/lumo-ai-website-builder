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

  assert.match(page, /requireCurrentDatabaseUser/);
  assert.match(dashboard, /dashboardConfigs/);
  assert.match(dashboard, /updateDashboardType/);
  assert.match(dashboard, /Xuất CSV/);
  assert.match(dashboard, /method: "PATCH"/);
  assert.match(dashboardConfig, /Bán sản phẩm \/ Đơn hàng/);
  assert.match(dashboardConfig, /Quảng bá sự kiện/);
  assert.doesNotMatch(dashboardConfig, /bookings|Quản lý lịch hẹn|Đặt lịch \/ Đặt bàn/);
  assert.match(dashboardConfig, /inferDashboardType/);
  assert.match(projectApi, /resolvedDashboardType/);
  assert.match(projectApi, /export async function PATCH/);
  assert.match(api, /export async function PATCH/);
  assert.match(api, /projects\.ownerId/);
  assert.match(api, /datetime\('now', '-2 minutes'\)/);
  assert.doesNotMatch(api, /runBookingWorkflow|bookings/);
  assert.match(schema, /status: text\("status"\)/);
  assert.match(schema, /notes: text\("notes"\)/);
  assert.doesNotMatch(schema, /scheduledAt|workflowStatus|workflowError/);
  assert.match(schema, /dashboardType: text\("dashboard_type"\)/);
  assert.match(schema, /export const orders/);
  assert.match(schema, /export const authSessions/);
  assert.match(schema, /googleSub: text\("google_sub"\)/);
  assert.doesNotMatch(schema, /payment_status|stripe_session/);
  assert.match(database, /ALTER TABLE leads ADD COLUMN status/);
  assert.match(database, /ALTER TABLE projects ADD COLUMN dashboard_type/);
  assert.match(database, /ALTER TABLE orders ADD COLUMN confirmation_email_sent_at/);
  assert.match(database, /ALTER TABLE orders ADD COLUMN calendar_event_id/);
  assert.doesNotMatch(database, /ALTER TABLE leads ADD COLUMN scheduled_at/);
  assert.doesNotMatch(database, /ALTER TABLE leads ADD COLUMN workflow_status/);
  assert.match(database, /dashboard_type = 'leads'.*dashboard_type = 'bookings'/s);
  assert.match(database, /CREATE TABLE IF NOT EXISTS orders/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS auth_sessions/);
  assert.match(studio, /\/dashboard\?projectId=/);
  assert.match(landing, /const formElement = event\.currentTarget/);
  assert.match(landing, /formElement\.reset\(\)/);
  assert.match(landing, /submissionType === "orders"/);
  assert.doesNotMatch(landing, /"datetime-local"|Ngày giờ hẹn|submissionType === "bookings"/);
  assert.match(ordersApi, /inferDashboardType/);
  assert.match(ordersApi, /runOrderWorkflow/);
  assert.doesNotMatch(ordersApi, /Stripe|checkoutUrl|paymentStatus/);
  assert.match(googleWorkflow, /sendSmtpEmail/);
  assert.match(googleWorkflow, /calendar\/v3\/calendars/);
  assert.doesNotMatch(googleWorkflow, /runBookingWorkflow|parseAppointmentTime|BookingRecord/);
  assert.doesNotMatch(dashboard, /Tự động hóa Google|Đã tạo lịch tư vấn/);
});
