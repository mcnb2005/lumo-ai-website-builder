import { ensureDatabase, getD1 } from "../../../../../db";
import { safeRelativeReturnPath } from "../../../../google-auth";
import {
  hashPassword,
  isAcceptablePassword,
  verifyPassword,
} from "../../../../password-auth";
import { getCurrentDatabaseUser } from "../../../../server-user";

export async function POST(request: Request) {
  try {
    const user = await getCurrentDatabaseUser();
    if (!user) {
      return Response.json(
        { error: "Đăng nhập để đổi mật khẩu." },
        { status: 401 }
      );
    }

    const payload = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
      returnTo?: string;
    };
    const currentPassword = payload.currentPassword || "";
    const newPassword = payload.newPassword || "";
    if (!isAcceptablePassword(newPassword)) {
      return Response.json(
        { error: "Mật khẩu mới cần có ít nhất 8 ký tự." },
        { status: 400 }
      );
    }

    await ensureDatabase();
    const account = await getD1()
      .prepare("SELECT password_hash FROM users WHERE id = ? LIMIT 1")
      .bind(user.id)
      .first<{ password_hash: string | null }>();
    if (
      !account?.password_hash ||
      !(await verifyPassword(currentPassword, account.password_hash))
    ) {
      return Response.json(
        { error: "Mật khẩu hiện tại chưa đúng." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    await getD1()
      .prepare(
        `UPDATE users
         SET password_hash = ?, must_change_password = 0,
             password_updated_at = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(await hashPassword(newPassword), now, now, user.id)
      .run();

    const returnTo = safeRelativeReturnPath(payload.returnTo);
    return Response.json({
      ok: true,
      redirectTo: returnTo === "/account/password" ? "/" : returnTo,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể đổi mật khẩu.",
      },
      { status: 500 }
    );
  }
}
