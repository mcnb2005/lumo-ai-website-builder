import { and, eq } from "drizzle-orm";
import { ensureDatabase, getD1, getDb } from "../../../db";
import { projects } from "../../../db/schema";
import {
  normalizeLandingData,
  type LandingData,
} from "../../landing-data";
import {
  forbiddenCompanyResponse,
  getAuthenticatedCompanyContext,
  unauthorizedCompanyResponse,
} from "../../company-access";
import { canPublishLanding } from "../../company-data";
import {
  normalizeProjectSlug,
  normalizePublishSettings,
} from "../../publish-settings";
import { createProjectSnapshot } from "../../server/project-versions";

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedCompanyContext();
    if (!auth) return unauthorizedCompanyResponse();
    if (
      auth.user.mustChangePassword ||
      !canPublishLanding(auth.company.role)
    ) {
      return forbiddenCompanyResponse();
    }
    const user = auth.user;

    const payload = (await request.json()) as {
      id?: string;
      name?: string;
      slug?: string;
      data?: unknown;
      messages?: unknown;
      publishSettings?: unknown;
    };
    const id = payload.id?.trim();
    const name = payload.name?.trim();
    const slug = normalizeProjectSlug(payload.slug);

    if (!id || !name || !slug || !payload.data) {
      return Response.json(
        { error: "Thiếu thông tin để xuất bản landing page." },
        { status: 400 }
      );
    }

    await ensureDatabase();
    const db = getDb();
    const [existing] = await db
      .select({
        ownerId: projects.ownerId,
        slug: projects.slug,
        deletedAt: projects.deletedAt,
      })
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);
    if (existing && (existing.ownerId !== user.id || existing.deletedAt)) {
      return Response.json(
        { error: "Bạn không có quyền xuất bản dự án này." },
        { status: 403 }
      );
    }

    const publishSettings = normalizePublishSettings(payload.publishSettings);
    const requestedAssets = [
      publishSettings.ogAssetId,
      publishSettings.faviconAssetId,
    ].filter((value): value is string => Boolean(value));
    if (requestedAssets.length) {
      const placeholders = requestedAssets.map(() => "?").join(", ");
      const result = await getD1()
        .prepare(
          `SELECT id FROM assets
           WHERE project_id = ? AND owner_id = ? AND id IN (${placeholders})`
        )
        .bind(id, user.id, ...requestedAssets)
        .all<{ id: string }>();
      if ((result.results || []).length !== new Set(requestedAssets).size) {
        return Response.json(
          { error: "Ảnh SEO phải thuộc đúng dự án hiện tại." },
          { status: 400 }
        );
      }
    }

    const slugOwner = await getD1()
      .prepare(
        `SELECT id FROM projects
         WHERE slug = ? AND id <> ?
         LIMIT 1`
      )
      .bind(slug, id)
      .first<{ id: string }>();
    const redirectOwner = await getD1()
      .prepare(
        `SELECT project_id FROM project_slug_redirects
         WHERE slug = ? LIMIT 1`
      )
      .bind(slug)
      .first<{ project_id: string }>();
    if (slugOwner || (redirectOwner && redirectOwner.project_id !== id)) {
      return Response.json(
        { error: "Đường dẫn xuất bản đã được sử dụng." },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const values = {
      id,
      ownerId: user.id,
      createdById: user.id,
      companyId: auth.company.companyId,
      name,
      slug,
      data: JSON.stringify(
        normalizeLandingData(payload.data as Partial<LandingData>)
      ),
      messages: JSON.stringify(payload.messages || []),
      status: "published",
      publishSettings: JSON.stringify(publishSettings),
      updatedAt: now,
      publishedAt: now,
    };

    if (existing) {
      if (existing.slug !== slug) {
        await getD1()
          .prepare(
            "DELETE FROM project_slug_redirects WHERE slug = ? AND project_id = ?"
          )
          .bind(slug, id)
          .run();
        await getD1()
          .prepare(
            `INSERT INTO project_slug_redirects (slug, project_id, created_at)
             VALUES (?, ?, ?)
             ON CONFLICT(slug) DO UPDATE SET
               project_id = excluded.project_id,
               created_at = excluded.created_at`
          )
          .bind(existing.slug, id, now)
          .run();
      }
      await db
        .update(projects)
        .set(values)
        .where(and(eq(projects.id, id), eq(projects.ownerId, user.id)));
    } else {
      await db.insert(projects).values(values);
    }

    await createProjectSnapshot({
      projectId: id,
      userId: user.id,
      reason: "publish",
      force: true,
    });

    return Response.json({
      published: true,
      url: `/p/${slug}`,
      slug,
      publishSettings,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Không thể xuất bản landing page.";
    return Response.json(
      {
        error: message.includes("UNIQUE")
          ? "Đường dẫn xuất bản đã được sử dụng."
          : message,
      },
      { status: 500 }
    );
  }
}
