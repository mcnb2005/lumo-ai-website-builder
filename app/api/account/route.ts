import { ensureDatabase, getD1 } from "../../../db";
import { getAuthenticatedCompanyContext } from "../../company-access";
import {
  AUTH_SESSION_COOKIE,
  isSecureRequest,
  serializeCookie,
} from "../../google-auth";

function unauthorized() {
  return Response.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
}

export async function GET() {
  await ensureDatabase();
  const auth = await getAuthenticatedCompanyContext();
  if (!auth) return unauthorized();
  const row = await getD1()
    .prepare(
      `SELECT password_hash, created_at
       FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1`
    )
    .bind(auth.user.id)
    .first<{ password_hash: string | null; created_at: string }>();
  return Response.json({
    account: {
      id: auth.user.id,
      name: auth.user.name,
      email: auth.user.email,
      username: auth.user.username || null,
      avatarUrl: auth.user.avatarUrl || null,
      companyName: auth.company.companyName,
      companyRole: auth.company.role,
      hasPassword: Boolean(row?.password_hash),
      createdAt: row?.created_at || null,
    },
  });
}

export async function DELETE(request: Request) {
  await ensureDatabase();
  const auth = await getAuthenticatedCompanyContext();
  if (!auth) return unauthorized();
  const payload = (await request.json()) as { confirmation?: unknown };
  if (payload.confirmation !== "XOA TAI KHOAN") {
    return Response.json(
      { error: "Hãy nhập chính xác XOA TAI KHOAN để xác nhận." },
      { status: 400 }
    );
  }

  if (auth.company.role === "owner") {
    const otherMembers = await getD1()
      .prepare(
        `SELECT COUNT(*) AS count FROM company_members
         WHERE company_id = ? AND status = 'active' AND user_id <> ?`
      )
      .bind(auth.company.companyId, auth.user.id)
      .first<{ count: number }>();
    if (Number(otherMembers?.count || 0) > 0) {
      return Response.json(
        {
          error:
            "Bạn đang là chủ công ty có thành viên khác. Hãy chuyển quyền sở hữu hoặc xóa thành viên trước.",
        },
        { status: 409 }
      );
    }
  }

  const now = new Date().toISOString();
  const statements = [
    getD1()
      .prepare(
        `INSERT INTO company_audit_logs
          (id, company_id, actor_user_id, action, entity_type, entity_id, metadata)
         VALUES (?, ?, ?, 'account.deleted', 'user', ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        auth.company.companyId,
        auth.user.id,
        auth.user.id,
        JSON.stringify({ role: auth.company.role })
      ),
  ];
  if (auth.company.role === "owner") {
    statements.push(
      getD1()
        .prepare(
          `UPDATE projects
           SET status = 'archived', deleted_at = COALESCE(deleted_at, ?),
               published_at = NULL, updated_at = ?
           WHERE company_id = ?`
        )
        .bind(now, now, auth.company.companyId),
      getD1()
        .prepare(
          `UPDATE companies
           SET notification_email = NULL,
               notification_email_verified_at = NULL, updated_at = ?
           WHERE id = ?`
        )
        .bind(now, auth.company.companyId),
      getD1()
        .prepare(
          "DELETE FROM company_notification_email_verifications WHERE company_id = ?"
        )
        .bind(auth.company.companyId)
    );
  } else {
    statements.push(
      getD1()
        .prepare(
          `UPDATE projects SET owner_id = ?, updated_at = ?
           WHERE owner_id = ? AND company_id = ?`
        )
        .bind(
          auth.company.companyOwnerId,
          now,
          auth.user.id,
          auth.company.companyId
        )
    );
  }
  statements.push(
    getD1()
      .prepare(
        `UPDATE company_members SET status = 'removed', updated_at = ?
         WHERE user_id = ? AND status = 'active'`
      )
      .bind(now, auth.user.id),
    getD1()
      .prepare("DELETE FROM google_connections WHERE user_id = ?")
      .bind(auth.user.id),
    getD1()
      .prepare("DELETE FROM password_reset_tokens WHERE user_id = ?")
      .bind(auth.user.id),
    getD1()
      .prepare("DELETE FROM auth_states WHERE user_id = ?")
      .bind(auth.user.id),
    getD1()
      .prepare("DELETE FROM auth_sessions WHERE user_id = ?")
      .bind(auth.user.id),
    getD1()
      .prepare(
        `UPDATE users
         SET email = ?, username = NULL, name = 'Tài khoản đã xóa',
             google_sub = NULL, avatar_url = NULL, password_hash = NULL,
             must_change_password = 0, deleted_at = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(`deleted-${auth.user.id}@lumo.local`, now, now, auth.user.id)
  );
  await getD1().batch(statements);

  const response = Response.json({ deleted: true });
  response.headers.append(
    "Set-Cookie",
    serializeCookie(AUTH_SESSION_COOKIE, "", {
      maxAge: 0,
      secure: isSecureRequest(request),
    })
  );
  return response;
}
