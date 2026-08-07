import { and, eq } from "drizzle-orm";
import { ensureDatabase, getDb } from "../../../db";
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
    };
    const id = payload.id?.trim();
    const name = payload.name?.trim();
    const slug = payload.slug
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!id || !name || !slug || !payload.data) {
      return Response.json(
        { error: "Thiếu thông tin để xuất bản landing page." },
        { status: 400 }
      );
    }

    await ensureDatabase();
    const db = getDb();
    const [existing] = await db
      .select({ ownerId: projects.ownerId })
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);
    if (existing && existing.ownerId !== user.id) {
      return Response.json(
        { error: "Bạn không có quyền xuất bản dự án này." },
        { status: 403 }
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
      updatedAt: now,
      publishedAt: now,
    };

    if (existing) {
      await db
        .update(projects)
        .set(values)
        .where(and(eq(projects.id, id), eq(projects.ownerId, user.id)));
    } else {
      await db.insert(projects).values(values);
    }

    return Response.json({ published: true, url: `/p/${slug}` });
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
