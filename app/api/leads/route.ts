import { and, desc, eq } from "drizzle-orm";
import { ensureDatabase, getDb } from "../../../db";
import { leads, projects } from "../../../db/schema";
import { getCurrentDatabaseUser } from "../../server-user";

export async function GET(request: Request) {
  try {
    const user = await getCurrentDatabaseUser();
    if (!user) {
      return Response.json(
        { error: "Đăng nhập để xem khách hàng tiềm năng." },
        { status: 401 }
      );
    }
    const projectId = new URL(request.url).searchParams.get("projectId");
    if (!projectId) {
      return Response.json({ error: "Thiếu mã dự án." }, { status: 400 });
    }

    await ensureDatabase();
    const [project] = await getDb()
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(eq(projects.id, projectId), eq(projects.ownerId, user.id))
      )
      .limit(1);
    if (!project) {
      return Response.json(
        { error: "Bạn không có quyền xem dữ liệu này." },
        { status: 403 }
      );
    }

    const rows = await getDb()
      .select()
      .from(leads)
      .where(eq(leads.projectId, projectId))
      .orderBy(desc(leads.createdAt))
      .limit(100);
    return Response.json({
      leads: rows.map((row) => ({
        id: row.id,
        values: JSON.parse(row.payload),
        createdAt: row.createdAt,
      })),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể tải danh sách liên hệ.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      slug?: string;
      values?: Record<string, string>;
    };
    const slug = payload.slug?.trim();
    const values = payload.values;
    if (!slug || !values || typeof values !== "object") {
      return Response.json(
        { error: "Thông tin gửi lên chưa hợp lệ." },
        { status: 400 }
      );
    }

    const safeValues = Object.fromEntries(
      Object.entries(values)
        .slice(0, 12)
        .map(([key, value]) => [
          key.slice(0, 80),
          String(value).trim().slice(0, 2000),
        ])
    );
    if (!Object.values(safeValues).some(Boolean)) {
      return Response.json(
        { error: "Hãy nhập ít nhất một thông tin." },
        { status: 400 }
      );
    }

    await ensureDatabase();
    const [project] = await getDb()
      .select({ id: projects.id, status: projects.status })
      .from(projects)
      .where(eq(projects.slug, slug))
      .limit(1);
    if (!project || project.status !== "published") {
      return Response.json(
        { error: "Landing page chưa được xuất bản." },
        { status: 404 }
      );
    }

    await getDb().insert(leads).values({
      id: crypto.randomUUID(),
      projectId: project.id,
      payload: JSON.stringify(safeValues),
    });
    return Response.json({ submitted: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể gửi thông tin lúc này.",
      },
      { status: 500 }
    );
  }
}
