import { resetPasswordWithToken } from "../../../../server/account-security";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      token?: unknown;
      password?: unknown;
    };
    if (
      typeof payload.token !== "string" ||
      !payload.token ||
      typeof payload.password !== "string"
    ) {
      return Response.json(
        { error: "Yêu cầu đặt lại mật khẩu chưa hợp lệ." },
        { status: 400 }
      );
    }
    await resetPasswordWithToken(payload.token, payload.password);
    return Response.json({
      reset: true,
      message: "Đã đổi mật khẩu. Bạn có thể đăng nhập lại.",
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể đặt lại mật khẩu.",
      },
      { status: 400 }
    );
  }
}
