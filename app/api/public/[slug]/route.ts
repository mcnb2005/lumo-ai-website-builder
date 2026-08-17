import { getPublishedProjectBySlug } from "../../../server/public-project";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const project = await getPublishedProjectBySlug(slug);
    if (!project) {
      return Response.json(
        { error: "Landing page này chưa được xuất bản." },
        { status: 404 }
      );
    }
    if (project.redirected) {
      return Response.redirect(
        new URL(`/api/public/${encodeURIComponent(project.slug)}`, request.url),
        308
      );
    }
    return Response.json({
      landing: project.landing,
      name: project.name,
      dashboardType: project.dashboardType,
      publishSettings: project.publishSettings,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Không thể mở landing page.",
      },
      { status: 500 }
    );
  }
}
