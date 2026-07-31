import { getCurrentDatabaseUser } from "../../../server-user";
import {
  getSmtpStatus,
  sendSmtpEmail,
} from "../../../server/smtp-email";

export async function GET() {
  const user = await getCurrentDatabaseUser();
  if (!user) {
    return Response.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
  }
  try {
    return Response.json({ email: getSmtpStatus() });
  } catch (error) {
    return Response.json(
      {
        email: { configured: false },
        error:
          error instanceof Error
            ? error.message
            : "Cấu hình SMTP không hợp lệ.",
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  const user = await getCurrentDatabaseUser();
  if (!user) {
    return Response.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
  }
  try {
    const sentAt = await sendSmtpEmail({
      to: user.email,
      subject: "Kiểm tra SMTP từ Lumo",
      text: [
        `Xin chào ${user.name || user.email},`,
        "",
        "SMTP đã được cấu hình thành công cho Lumo.",
        "Từ bây giờ hệ thống có thể tự động gửi lời mời và email xác nhận.",
      ].join("\r\n"),
    });
    if (!sentAt) {
      return Response.json(
        { error: "SMTP chưa được cấu hình." },
        { status: 503 }
      );
    }
    return Response.json({ sent: true, sentAt });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Không thể gửi email thử.",
      },
      { status: 502 }
    );
  }
}
