import { ensureDatabase, getD1 } from "../../../../../db";
import { hashOpaqueToken } from "../../../../google-auth";
import { getCurrentDatabaseUser } from "../../../../server-user";

export async function POST(request: Request) {
  try {
    const user = await getCurrentDatabaseUser();
    if (!user) {
      return Response.json(
        { error: "Đăng nhập Google để nhận lời mời." },
        { status: 401 }
      );
    }
    const payload = (await request.json()) as {
      token?: string;
      confirmTransfer?: boolean;
    };
    const token = payload.token?.trim();
    if (!token) {
      return Response.json(
        { error: "Đường dẫn lời mời không hợp lệ." },
        { status: 400 }
      );
    }
    await ensureDatabase();
    const now = new Date().toISOString();
    const tokenHash = await hashOpaqueToken(token);
    const invitation = await getD1()
      .prepare(
        `SELECT
          ci.id,
          ci.company_id,
          ci.email,
          ci.role,
          ci.invited_by,
          ci.expires_at,
          ci.accepted_at,
          c.name AS company_name
        FROM company_invitations ci
        INNER JOIN companies c ON c.id = ci.company_id
        WHERE ci.token_hash = ?
        LIMIT 1`
      )
      .bind(tokenHash)
      .first<{
        id: string;
        company_id: string;
        email: string;
        role: string;
        invited_by: string;
        expires_at: string;
        accepted_at: string | null;
        company_name: string;
      }>();
    if (
      !invitation ||
      invitation.accepted_at ||
      invitation.expires_at <= now
    ) {
      return Response.json(
        { error: "Lời mời đã hết hạn hoặc đã được sử dụng." },
        { status: 410 }
      );
    }
    if (
      invitation.email.trim().toLowerCase() !==
      user.email.trim().toLowerCase()
    ) {
      return Response.json(
        {
          error: `Hãy đăng nhập bằng đúng tài khoản ${invitation.email}.`,
        },
        { status: 403 }
      );
    }

    const membership = await getD1()
      .prepare(
        `SELECT
          cm.id,
          cm.company_id,
          cm.role,
          c.name AS company_name,
          (SELECT COUNT(*) FROM company_members sibling
           WHERE sibling.company_id = cm.company_id
             AND sibling.status = 'active') AS member_count
        FROM company_members cm
        INNER JOIN companies c ON c.id = cm.company_id
        WHERE cm.user_id = ? AND cm.status = 'active'
        ORDER BY cm.created_at ASC
        LIMIT 1`
      )
      .bind(user.id)
      .first<{
        id: string;
        company_id: string;
        role: string;
        company_name: string;
        member_count: number;
      }>();

    if (membership?.company_id === invitation.company_id) {
      await getD1()
        .prepare(
          "UPDATE company_invitations SET accepted_at = ? WHERE id = ?"
        )
        .bind(now, invitation.id)
        .run();
      return Response.json({
        joined: true,
        companyName: invitation.company_name,
      });
    }

    if (
      membership &&
      (membership.role !== "owner" || Number(membership.member_count) > 1)
    ) {
      return Response.json(
        {
          error:
            "Tài khoản đang thuộc một công ty khác. Hãy rời công ty đó trước khi nhận lời mời mới.",
        },
        { status: 409 }
      );
    }

    if (membership && !payload.confirmTransfer) {
      return Response.json({
        requiresTransfer: true,
        currentCompanyName: membership.company_name,
        targetCompanyName: invitation.company_name,
        message:
          "Tài khoản đang có không gian cá nhân. Khi tham gia, các project cá nhân sẽ được chuyển vào công ty mới.",
      });
    }

    const statements = [];
    if (membership) {
      statements.push(
        getD1()
          .prepare(
            `UPDATE company_members
             SET status = 'removed', updated_at = ?
             WHERE id = ?`
          )
          .bind(now, membership.id),
        getD1()
          .prepare(
            `UPDATE projects
             SET company_id = ?, updated_at = ?
             WHERE company_id = ? AND owner_id = ? AND deleted_at IS NULL`
          )
          .bind(
            invitation.company_id,
            now,
            membership.company_id,
            user.id
          )
      );
    }
    statements.push(
      getD1()
        .prepare(
          `INSERT INTO company_members
           (id, company_id, user_id, role, status, invited_by, joined_at, updated_at)
           VALUES (?, ?, ?, ?, 'active', ?, ?, ?)
           ON CONFLICT(company_id, user_id) DO UPDATE SET
             role = excluded.role,
             status = 'active',
             invited_by = excluded.invited_by,
             joined_at = excluded.joined_at,
             updated_at = excluded.updated_at`
        )
        .bind(
          crypto.randomUUID(),
          invitation.company_id,
          user.id,
          invitation.role === "admin" ? "admin" : "member",
          invitation.invited_by,
          now,
          now
        ),
      getD1()
        .prepare(
          "UPDATE company_invitations SET accepted_at = ? WHERE id = ?"
        )
        .bind(now, invitation.id),
      getD1()
        .prepare(
          `INSERT INTO company_audit_logs
           (id, company_id, actor_user_id, action, entity_type, entity_id, metadata)
           VALUES (?, ?, ?, 'member.joined', 'user', ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          invitation.company_id,
          user.id,
          user.id,
          JSON.stringify({
            email: user.email,
            role: invitation.role,
            invitationId: invitation.id,
          })
        )
    );
    await getD1().batch(statements);
    return Response.json({
      joined: true,
      companyName: invitation.company_name,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể nhận lời mời công ty.",
      },
      { status: 500 }
    );
  }
}
