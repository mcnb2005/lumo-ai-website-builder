import { and, desc, eq, isNull } from "drizzle-orm";
import { ensureDatabase, getD1, getDb } from "../../../db";
import { assets, projects } from "../../../db/schema";
import {
  inferDashboardType,
  isDashboardType,
  type DashboardType,
} from "../../dashboard-config";
import { getCurrentDatabaseUser } from "../../server-user";
import {
  getAccessibleProject,
  getAuthenticatedCompanyContext,
  forbiddenCompanyResponse,
  unauthorizedCompanyResponse,
} from "../../company-access";
import {
  canCreateLanding,
  canEditLanding,
  canManageCompany,
  writeCompanyAudit,
} from "../../company-data";
import {
  normalizeProjectSlug,
  normalizePublishSettings,
  parseStoredPublishSettings,
} from "../../publish-settings";
import { createProjectSnapshot } from "../../server/project-versions";

type ProjectPayload = {
  id?: string;
  name?: string;
  slug?: string;
  data?: unknown;
  messages?: unknown;
  status?: string;
  dashboardType?: DashboardType;
  publishSettings?: unknown;
};

function parseProject(row: typeof projects.$inferSelect) {
  const data = JSON.parse(row.data);
  return {
    ...row,
    data,
    messages: JSON.parse(row.messages),
    publishSettings: parseStoredPublishSettings(row.publishSettings),
    resolvedDashboardType:
      row.dashboardType === "auto"
        ? inferDashboardType(data)
        : row.dashboardType,
  };
}

async function validatePublishAssets(
  projectId: string,
  ownerId: string,
  publishSettings: ReturnType<typeof normalizePublishSettings>
) {
  const ids = [publishSettings.ogAssetId, publishSettings.faviconAssetId].filter(
    (value): value is string => Boolean(value)
  );
  if (!ids.length) return;
  const placeholders = ids.map(() => "?").join(", ");
  const result = await getD1()
    .prepare(
      `SELECT id FROM assets
       WHERE project_id = ? AND owner_id = ? AND id IN (${placeholders})`
    )
    .bind(projectId, ownerId, ...ids)
    .all<{ id: string }>();
  if ((result.results || []).length !== new Set(ids).size) {
    throw new Error("Ảnh SEO phải thuộc đúng dự án hiện tại.");
  }
}

function unauthorized() {
  return Response.json(
    { error: "Đăng nhập để quản lý dự án của bạn." },
    { status: 401 }
  );
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentDatabaseUser();
    if (!user) return unauthorized();

    const requestUrl = new URL(request.url);
    const id = requestUrl.searchParams.get("id");
    if (id) {
      const [row] = await getDb()
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.id, id),
            eq(projects.ownerId, user.id),
            isNull(projects.deletedAt)
          )
        )
        .limit(1);
      return Response.json({ project: row ? parseProject(row) : null });
    }

    const rows = await getDb()
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        status: projects.status,
        dashboardType: projects.dashboardType,
        data: projects.data,
        updatedAt: projects.updatedAt,
        publishedAt: projects.publishedAt,
      })
      .from(projects)
      .where(and(eq(projects.ownerId, user.id), isNull(projects.deletedAt)))
      .orderBy(desc(projects.updatedAt));
    const projectSummaries = rows.map(({ data, ...row }) => ({
      ...row,
      resolvedDashboardType:
        row.dashboardType === "auto"
          ? inferDashboardType(JSON.parse(data))
          : row.dashboardType,
    }));
    if (requestUrl.searchParams.get("bootstrap") !== "1" || !rows.length) {
      return Response.json({ projects: projectSummaries });
    }

    const activeProjectId = rows[0].id;
    const [activeProject, projectAssets] = await Promise.all([
      getDb()
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.id, activeProjectId),
            eq(projects.ownerId, user.id),
            isNull(projects.deletedAt)
          )
        )
        .limit(1),
      getDb()
        .select({
          id: assets.id,
          filename: assets.filename,
          createdAt: assets.createdAt,
        })
        .from(assets)
        .where(
          and(
            eq(assets.projectId, activeProjectId),
            eq(assets.ownerId, user.id)
          )
        )
        .orderBy(desc(assets.createdAt)),
    ]);

    return Response.json({
      projects: projectSummaries,
      project: activeProject[0] ? parseProject(activeProject[0]) : null,
      assets: projectAssets.map((asset) => ({
        id: asset.id,
        url: `/api/assets/${asset.id}`,
        alt: asset.filename.replace(/\.[^.]+$/, ""),
        createdAt: asset.createdAt,
      })),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Không thể tải dự án.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedCompanyContext();
    if (!auth) return unauthorizedCompanyResponse();
    if (
      auth.user.mustChangePassword ||
      !canCreateLanding(auth.company.role)
    ) {
      return forbiddenCompanyResponse();
    }
    const user = auth.user;

    const payload = (await request.json()) as ProjectPayload;
    const id = payload.id?.trim();
    const name = payload.name?.trim();
    const slug = normalizeProjectSlug(payload.slug);

    if (!id || !name || !slug || !payload.data) {
      return Response.json(
        { error: "Thiếu thông tin dự án." },
        { status: 400 }
      );
    }

    await ensureDatabase();
    const db = getDb();
    const [existing] = await db
      .select({
        ownerId: projects.ownerId,
        companyId: projects.companyId,
        dashboardType: projects.dashboardType,
        publishSettings: projects.publishSettings,
        deletedAt: projects.deletedAt,
      })
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);
    if (existing && (existing.ownerId !== user.id || existing.deletedAt)) {
      return Response.json(
        { error: "Bạn không có quyền sửa dự án này." },
        { status: 403 }
      );
    }

    const publishSettings =
      payload.publishSettings === undefined && existing
        ? parseStoredPublishSettings(existing.publishSettings)
        : normalizePublishSettings(payload.publishSettings);
    await validatePublishAssets(id, user.id, publishSettings);
    if (existing) {
      await createProjectSnapshot({
        projectId: id,
        userId: user.id,
        reason: "autosave",
      });
    }

    const now = new Date().toISOString();
    const values = {
      id,
      ownerId: user.id,
      createdById: user.id,
      companyId: auth.company.companyId || existing?.companyId || null,
      name,
      slug,
      data: JSON.stringify(payload.data),
      messages: JSON.stringify(payload.messages || []),
      status: payload.status === "published" ? "published" : "draft",
      dashboardType: isDashboardType(payload.dashboardType)
        ? payload.dashboardType
        : existing?.dashboardType || "auto",
      publishSettings: JSON.stringify(publishSettings),
      updatedAt: now,
    };

    if (existing) {
      await db
        .update(projects)
        .set(values)
        .where(
          and(
            eq(projects.id, id),
            eq(projects.ownerId, user.id),
            isNull(projects.deletedAt)
          )
        );
    } else {
      await db.insert(projects).values(values);
      await createProjectSnapshot({
        projectId: id,
        userId: user.id,
        reason: "initial",
        force: true,
      });
    }

    return Response.json({ saved: true, updatedAt: now });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Không thể lưu dự án.";
    return Response.json(
      {
        error: message.includes("UNIQUE")
          ? "Đường dẫn dự án đã được sử dụng."
          : message,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthenticatedCompanyContext();
    if (!auth) return unauthorizedCompanyResponse();
    if (auth.user.mustChangePassword || !canEditLanding(auth.company.role)) {
      return forbiddenCompanyResponse();
    }
    const user = auth.user;

    const payload = (await request.json()) as {
      action?: unknown;
      id?: string;
      dashboardType?: unknown;
    };
    const id = payload.id?.trim();
    if (!id) {
      return Response.json({ error: "Thiếu mã dự án." }, { status: 400 });
    }

    await ensureDatabase();
    if (payload.action === "restoreDeleted") {
      const project = await getD1()
        .prepare(
          `SELECT id, owner_id, company_id, name, deleted_at
           FROM projects WHERE id = ? LIMIT 1`
        )
        .bind(id)
        .first<{
          id: string;
          owner_id: string | null;
          company_id: string | null;
          name: string;
          deleted_at: string | null;
        }>();
      const canRestore =
        project?.deleted_at &&
        (project.owner_id === user.id ||
          (project.company_id === auth.company.companyId &&
            canManageCompany(auth.company.role)));
      if (!project || !canRestore) return forbiddenCompanyResponse();
      const now = new Date().toISOString();
      await getD1()
        .prepare(
          `UPDATE projects
           SET deleted_at = NULL, status = 'draft', published_at = NULL,
               updated_at = ?
           WHERE id = ?`
        )
        .bind(now, id)
        .run();
      await writeCompanyAudit(
        auth.company,
        "project.restored",
        "project",
        id,
        { name: project.name }
      );
      return Response.json({ restored: true, updatedAt: now });
    }

    if (!isDashboardType(payload.dashboardType)) {
      return Response.json(
        { error: "Loại quản lý chưa hợp lệ." },
        { status: 400 }
      );
    }

    const db = getDb();
    const [project] = await db
      .select({ id: projects.id, data: projects.data })
      .from(projects)
      .where(
        and(
          eq(projects.id, id),
          eq(projects.ownerId, user.id),
          isNull(projects.deletedAt)
        )
      )
      .limit(1);
    if (!project) {
      return Response.json(
        { error: "Bạn không có quyền cập nhật dự án này." },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();
    await db
      .update(projects)
      .set({
        dashboardType: payload.dashboardType,
        updatedAt: now,
      })
      .where(
        and(
          eq(projects.id, id),
          eq(projects.ownerId, user.id),
          isNull(projects.deletedAt)
        )
      );

    return Response.json({
      dashboardType: payload.dashboardType,
      resolvedDashboardType:
        payload.dashboardType === "auto"
          ? inferDashboardType(JSON.parse(project.data))
          : payload.dashboardType,
      updatedAt: now,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể cập nhật loại quản lý.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getAuthenticatedCompanyContext();
    if (!auth) return unauthorizedCompanyResponse();
    if (auth.user.mustChangePassword || !canEditLanding(auth.company.role)) {
      return forbiddenCompanyResponse();
    }
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return Response.json({ error: "Thiếu mã dự án." }, { status: 400 });
    }
    await ensureDatabase();
    const project = await getAccessibleProject(auth, id, {
      companyManager: true,
    });
    if (!project) return forbiddenCompanyResponse();
    const deletedAt = new Date().toISOString();
    await getDb()
      .update(projects)
      .set({
        status: "archived",
        deletedAt,
        updatedAt: deletedAt,
      })
      .where(eq(projects.id, id));
    await writeCompanyAudit(
      auth.company,
      "project.deleted",
      "project",
      id,
      {
        name: project.name,
        previousOwnerId: project.owner_id,
      }
    );
    return Response.json({ deleted: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Không thể xóa dự án.",
      },
      { status: 500 }
    );
  }
}
