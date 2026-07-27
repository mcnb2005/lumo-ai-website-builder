import { and, eq } from "drizzle-orm";
import { ensureDatabase, getDb } from "../../../db";
import { projects } from "../../../db/schema";
import { getCurrentDatabaseUser } from "../../server-user";

export async function POST(request: Request) {
  try {
    const user = await getCurrentDatabaseUser();
    if (!user) {
      return Response.json(
        { error: "Đăng nhập để xuất bản landing page." },
        { status: 401 }
      );
    }

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
      name,
      slug,
      data: JSON.stringify(payload.data),
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
