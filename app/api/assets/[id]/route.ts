import { and, eq } from "drizzle-orm";
import { ensureDatabase, getAssetsBucket, getDb } from "../../../../db";
import { assets, projects } from "../../../../db/schema";
import { getCurrentDatabaseUser } from "../../../server-user";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await ensureDatabase();
    const [asset] = await getDb()
      .select({
        objectKey: assets.objectKey,
        contentType: assets.contentType,
        ownerId: assets.ownerId,
        status: projects.status,
      })
      .from(assets)
      .innerJoin(projects, eq(assets.projectId, projects.id))
      .where(eq(assets.id, id))
      .limit(1);
    if (!asset) {
      return new Response("Không tìm thấy ảnh.", { status: 404 });
    }

    if (asset.status !== "published") {
      const user = await getCurrentDatabaseUser();
      if (!user || user.id !== asset.ownerId) {
        return new Response("Bạn không có quyền xem ảnh.", { status: 403 });
      }
    }

    const object = await getAssetsBucket().get(asset.objectKey);
    if (!object) {
      return new Response("Không tìm thấy ảnh.", { status: 404 });
    }
    return new Response(object.body, {
      headers: {
        "Content-Type": asset.contentType,
        "Cache-Control":
          asset.status === "published"
            ? "public, max-age=3600"
            : "private, no-store",
        ETag: object.httpEtag,
      },
    });
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : "Không thể mở ảnh.",
      { status: 500 }
    );
  }
}
