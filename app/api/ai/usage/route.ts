import {
  getAuthenticatedCompanyContext,
  unauthorizedCompanyResponse,
} from "../../../company-access";
import { getAiUsageSummary } from "../../../server/ai-usage";

export async function GET() {
  try {
    const auth = await getAuthenticatedCompanyContext();
    if (!auth) return unauthorizedCompanyResponse();

    const usage = await getAiUsageSummary({
      userId: auth.user.id,
      email: auth.user.email,
      companyId: auth.company.companyId,
    });
    return Response.json({ usage });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể tải mức sử dụng AI.",
      },
      { status: 500 }
    );
  }
}
