import { ensureDatabase } from "../../../../db";
import {
  forbiddenCompanyResponse,
  getAuthenticatedCompanyContext,
  unauthorizedCompanyResponse,
} from "../../../company-access";
import { writeCompanyAudit } from "../../../company-data";
import {
  CompanyNotificationEmailError,
  requestCompanyNotificationEmailVerification,
  sendCompanyNotificationEmailTest,
  verifyCompanyNotificationEmail,
} from "../../../server/company-notification-email";

type NotificationEmailAction =
  | "requestVerification"
  | "verify"
  | "sendTest";

function isNotificationEmailAction(
  value: unknown
): value is NotificationEmailAction {
  return (
    value === "requestVerification" ||
    value === "verify" ||
    value === "sendTest"
  );
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedCompanyContext();
    if (!auth) return unauthorizedCompanyResponse();
    if (auth.user.mustChangePassword || auth.company.role !== "owner") {
      return forbiddenCompanyResponse();
    }
    const payload = (await request.json()) as {
      action?: unknown;
      email?: unknown;
      code?: unknown;
    };
    if (!isNotificationEmailAction(payload.action)) {
      return Response.json(
        { error: "Thao tác email nhận thông báo chưa hợp lệ." },
        { status: 400 }
      );
    }
    await ensureDatabase();

    if (payload.action === "requestVerification") {
      const settings = await requestCompanyNotificationEmailVerification({
        companyId: auth.company.companyId,
        userId: auth.user.id,
        email: payload.email,
      });
      await writeCompanyAudit(
        auth.company,
        "company.notification_email_verification_requested",
        "company",
        auth.company.companyId,
        { email: settings.pendingEmail }
      );
      return Response.json({
        settings,
        message: `Đã gửi mã xác minh tới ${settings.pendingEmail}.`,
      });
    }

    if (payload.action === "verify") {
      const settings = await verifyCompanyNotificationEmail({
        companyId: auth.company.companyId,
        code: payload.code,
      });
      await writeCompanyAudit(
        auth.company,
        "company.notification_email_verified",
        "company",
        auth.company.companyId,
        { email: settings.email }
      );
      return Response.json({
        settings,
        message: "Email nhận thông báo đã được xác minh.",
      });
    }

    const result = await sendCompanyNotificationEmailTest(
      auth.company.companyId
    );
    await writeCompanyAudit(
      auth.company,
      "company.notification_email_test_sent",
      "company",
      auth.company.companyId,
      { email: result.settings.email, sentAt: result.sentAt }
    );
    return Response.json({
      settings: result.settings,
      sentAt: result.sentAt,
      message: `Đã gửi email thử tới ${result.settings.email}.`,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể cập nhật email nhận thông báo.",
      },
      {
        status:
          error instanceof CompanyNotificationEmailError
            ? error.status
            : 500,
      }
    );
  }
}
