import { eq } from "drizzle-orm";
import { ensureDatabase, getDb } from "../../../db";
import { projects } from "../../../db/schema";

type ProjectPayload = {
  id?: string;
  name?: string;
  slug?: string;
  data?: unknown;
  messages?: unknown;
  status?: string;
};

function parseProject(row: typeof projects.$inferSelect) {
  return {
    ...row,
    data: JSON.parse(row.data),
    messages: JSON.parse(row.messages),
  };
}

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }
    await ensureDatabase();
    const [row] = await getDb()
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);
    return Response.json({ project: row ? parseProject(row) : null });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Không thể tải dự án." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ProjectPayload;
    const id = payload.id?.trim();
    const name = payload.name?.trim();
    const slug = payload.slug?.trim();

    if (!id || !name || !slug || !payload.data) {
      return Response.json(
        { error: "id, name, slug and data are required" },
        { status: 400 }
      );
    }

    await ensureDatabase();
    const db = getDb();
    const now = new Date().toISOString();
    const values = {
      id,
      name,
      slug,
      data: JSON.stringify(payload.data),
      messages: JSON.stringify(payload.messages || []),
      status: payload.status === "published" ? "published" : "draft",
      updatedAt: now,
    };

    await db
      .insert(projects)
      .values(values)
      .onConflictDoUpdate({
        target: projects.id,
        set: {
          name: values.name,
          slug: values.slug,
          data: values.data,
          messages: values.messages,
          status: values.status,
          updatedAt: values.updatedAt,
        },
      });

    return Response.json({ saved: true, updatedAt: now });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Không thể lưu dự án." },
      { status: 500 }
    );
  }
}
