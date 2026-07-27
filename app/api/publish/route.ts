import { ensureDatabase, getDb } from "../../../db";
import { projects } from "../../../db/schema";

export async function POST(request: Request) {
  try {
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
    const now = new Date().toISOString();
    await getDb()
      .insert(projects)
      .values({
        id,
        name,
        slug,
        data: JSON.stringify(payload.data),
        messages: JSON.stringify(payload.messages || []),
        status: "published",
        updatedAt: now,
        publishedAt: now,
      })
      .onConflictDoUpdate({
        target: projects.id,
        set: {
          name,
          slug,
          data: JSON.stringify(payload.data),
          messages: JSON.stringify(payload.messages || []),
          status: "published",
          updatedAt: now,
          publishedAt: now,
        },
      });

    return Response.json({ published: true, url: `/p/${slug}` });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể xuất bản landing page.",
      },
      { status: 500 }
    );
  }
}
