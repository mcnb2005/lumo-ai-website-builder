import {
  forbiddenCompanyResponse,
  getAccessibleProject,
  getAuthenticatedCompanyContext,
  unauthorizedCompanyResponse,
} from "../../../../company-access";
import { canEditLanding, writeCompanyAudit } from "../../../../company-data";
import {
  createProjectSnapshot,
  listProjectVersions,
  readProjectVersion,
  restoreProjectVersion,
} from "../../../../server/project-versions";

async function authorizedProject(id: string) {
  const auth = await getAuthenticatedCompanyContext();
  if (!auth) return { response: unauthorizedCompanyResponse() };
  if (auth.user.mustChangePassword || !canEditLanding(auth.company.role)) {
    return { response: forbiddenCompanyResponse() };
  }
  const project = await getAccessibleProject(auth, id, {
    companyManager: true,
  });
  if (!project) return { response: forbiddenCompanyResponse() };
  return { auth, project };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const access = await authorizedProject(id);
    if (access.response) return access.response;
    const versionId = new URL(request.url).searchParams.get("versionId");
    if (versionId) {
      const version = await readProjectVersion(id, versionId);
      return version
        ? Response.json({ version })
        : Response.json({ error: "Không tìm thấy phiên bản." }, { status: 404 });
    }
    return Response.json({ versions: await listProjectVersions(id) });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể tải lịch sử phiên bản.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const access = await authorizedProject(id);
    if (access.response || !access.auth || !access.project) {
      return access.response || forbiddenCompanyResponse();
    }
    const payload = (await request.json()) as {
      action?: unknown;
      versionId?: unknown;
    };
    if (payload.action === "snapshot") {
      const version = await createProjectSnapshot({
        projectId: id,
        userId: access.auth.user.id,
        reason: "before_ai",
        force: true,
      });
      return Response.json({ version });
    }
    if (payload.action === "restore" && typeof payload.versionId === "string") {
      const restored = await restoreProjectVersion({
        projectId: id,
        versionId: payload.versionId,
        userId: access.auth.user.id,
      });
      if (!restored) {
        return Response.json(
          { error: "Không tìm thấy phiên bản để khôi phục." },
          { status: 404 }
        );
      }
      await writeCompanyAudit(
        access.auth.company,
        "project.version_restored",
        "project",
        id,
        { versionId: payload.versionId, versionNumber: restored.versionNumber }
      );
      return Response.json({ restored });
    }
    return Response.json({ error: "Thao tác phiên bản chưa hợp lệ." }, { status: 400 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể cập nhật phiên bản.",
      },
      { status: 500 }
    );
  }
}
