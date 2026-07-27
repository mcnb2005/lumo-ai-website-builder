import { and, eq } from "drizzle-orm";
import { ensureDatabase, getDb } from "../../../../db";
import { projects } from "../../../../db/schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    await ensureDatabase();
    const [project] = await getDb()
      .select({ data: projects.data, name: projects.name })
      .from(projects)
      .where(and(eq(projects.slug, slug), eq(projects.status, "published")))
      .limit(1);

    if (!project) {
      return Response.json(
        { error: "Landing page này chưa được xuất bản." },
        { status: 404 }
      );
    }

    return Response.json({
      landing: JSON.parse(project.data),
      name: project.name,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể mở landing page.",
      },
      { status: 500 }
    );
  }
}
