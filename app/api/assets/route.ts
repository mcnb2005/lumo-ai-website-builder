import { and, eq } from "drizzle-orm";
import { ensureDatabase, getAssetsBucket, getDb } from "../../../db";
import { assets, projects } from "../../../db/schema";
import { getCurrentDatabaseUser } from "../../server-user";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function POST(request: Request) {
  try {
    const user = await getCurrentDatabaseUser();
    if (!user) {
      return Response.json(
        { error: "Đăng nhập để tải ảnh lên." },
        { status: 401 }
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    const projectId = form.get("projectId");
    if (!(file instanceof File) || typeof projectId !== "string") {
      return Response.json(
        { error: "Thiếu ảnh hoặc dự án." },
        { status: 400 }
      );
    }
    if (!IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_SIZE) {
      return Response.json(
        { error: "Chỉ hỗ trợ JPG, PNG, WebP, GIF tối đa 5 MB." },
        { status: 400 }
      );
    }

    await ensureDatabase();
    const db = getDb();
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(eq(projects.id, projectId), eq(projects.ownerId, user.id))
      )
      .limit(1);
    if (!project) {
      return Response.json(
        { error: "Hãy lưu dự án trước khi thêm ảnh." },
        { status: 404 }
      );
    }

    const id = crypto.randomUUID();
    const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
    const objectKey = `${user.id}/${projectId}/${id}.${extension}`;
    await getAssetsBucket().put(objectKey, file.stream(), {
      httpMetadata: { contentType: file.type },
    });
    await db.insert(assets).values({
      id,
      projectId,
      ownerId: user.id,
      objectKey,
      filename: file.name,
      contentType: file.type,
      size: file.size,
    });

    return Response.json({
      asset: {
        id,
        url: `/api/assets/${id}`,
        alt: file.name.replace(/\.[^.]+$/, ""),
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Không thể tải ảnh lên.",
      },
      { status: 500 }
    );
  }
}
