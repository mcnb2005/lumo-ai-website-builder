import {
  forbiddenCompanyResponse,
  getAccessibleProject,
  getAuthenticatedCompanyContext,
  unauthorizedCompanyResponse,
} from "../../company-access";
import { canEditLanding } from "../../company-data";
import {
  notificationRecordTypes,
  sendOwnerRecordNotification,
  type NotificationRecordType,
} from "../../server/owner-notifications";

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedCompanyContext();
    if (!auth) return unauthorizedCompanyResponse();
    if (auth.user.mustChangePassword || !canEditLanding(auth.company.role)) {
      return forbiddenCompanyResponse();
    }

    const payload = (await request.json()) as {
      projectId?: string;
      recordType?: unknown;
      recordId?: string;
    };
    const projectId = payload.projectId?.trim();
    const recordId = payload.recordId?.trim();
    const recordType =
      typeof payload.recordType === "string" &&
      notificationRecordTypes.includes(
        payload.recordType as NotificationRecordType
      )
        ? (payload.recordType as NotificationRecordType)
        : null;
    if (!projectId || !recordId || !recordType) {
      return Response.json(
        { error: "Thông tin gửi lại email chưa hợp lệ." },
        { status: 400 }
      );
    }

    const project = await getAccessibleProject(auth, projectId, {
      companyManager: true,
    });
    if (!project) return forbiddenCompanyResponse();

    const notification = await sendOwnerRecordNotification({
      projectId,
      recordType,
      recordId,
      origin: new URL(request.url).origin,
    });
    return Response.json(
      {
        notification,
        error:
          notification.status === "failed"
            ? notification.lastError || "Không thể gửi email thông báo."
            : undefined,
      },
      { status: notification.status === "sent" ? 200 : 502 }
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể gửi lại email thông báo.",
      },
      { status: 500 }
    );
  }
}
