import { requestPasswordReset } from "../../../../server/account-security";

const GENERIC_MESSAGE =
  "Nếu tài khoản có email hợp lệ, Lumo đã gửi liên kết đặt lại mật khẩu.";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { identifier?: unknown };
    const identifier =
      typeof payload.identifier === "string" ? payload.identifier : "";
    await requestPasswordReset(request, identifier);
    return Response.json({ message: GENERIC_MESSAGE });
  } catch {
    return Response.json({ message: GENERIC_MESSAGE });
  }
}
