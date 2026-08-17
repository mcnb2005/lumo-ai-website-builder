import { ensureDatabase, getD1 } from "../../../../db";
import { getCurrentDatabaseUser } from "../../../server-user";

function parseJson(value: unknown) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

export async function GET() {
  await ensureDatabase();
  const user = await getCurrentDatabaseUser();
  if (!user) {
    return Response.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
  }
  const [profile, memberships, projectRows, googleConnection] = await Promise.all([
    getD1()
      .prepare(
        `SELECT id, email, username, name, avatar_url AS avatarUrl,
                created_at AS createdAt, updated_at AS updatedAt
         FROM users WHERE id = ? LIMIT 1`
      )
      .bind(user.id)
      .first(),
    getD1()
      .prepare(
        `SELECT cm.company_id AS companyId, c.name AS companyName,
                cm.role, cm.status, cm.joined_at AS joinedAt
         FROM company_members cm
         INNER JOIN companies c ON c.id = cm.company_id
         WHERE cm.user_id = ?`
      )
      .bind(user.id)
      .all(),
    getD1()
      .prepare(
        `SELECT id, name, slug, status, dashboard_type AS dashboardType,
                data, messages, publish_settings AS publishSettings,
                created_at AS createdAt, updated_at AS updatedAt,
                published_at AS publishedAt, deleted_at AS deletedAt
         FROM projects WHERE owner_id = ? ORDER BY updated_at DESC`
      )
      .bind(user.id)
      .all<Record<string, unknown>>(),
    getD1()
      .prepare(
        `SELECT connected_email AS connectedEmail, scopes,
                created_at AS createdAt, updated_at AS updatedAt
         FROM google_connections WHERE user_id = ? LIMIT 1`
      )
      .bind(user.id)
      .first(),
  ]);
  const projects = (projectRows.results || []).map((project) => ({
    ...project,
    data: parseJson(project.data),
    messages: parseJson(project.messages),
    publishSettings: parseJson(project.publishSettings),
  }));
  const exportData = {
    exportedAt: new Date().toISOString(),
    account: profile,
    memberships: memberships.results || [],
    googleConnection: googleConnection || null,
    projects,
  };
  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="lumo-account-${user.id}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
