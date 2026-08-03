import { ensureDatabase, getD1 } from "../../../db";
import {
  canManageCompany,
  canManageMember,
  type CompanyRole,
  writeCompanyAudit,
} from "../../company-data";
import {
  forbiddenCompanyResponse,
  getAuthenticatedCompanyContext,
  unauthorizedCompanyResponse,
} from "../../company-access";
import { createOpaqueToken, hashOpaqueToken } from "../../google-auth";
import { sendSmtpEmail } from "../../server/smtp-email";

function validManagedRole(value: unknown): value is "admin" | "member" {
  return value === "admin" || value === "member";
}

function roleOf(value: string): CompanyRole {
  return value === "owner" || value === "admin" ? value : "member";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function GET() {
  try {
    const auth = await getAuthenticatedCompanyContext();
    if (!auth) return unauthorizedCompanyResponse();
    await ensureDatabase();
    const { company } = auth;
    const manager = canManageCompany(company.role);

    const members = manager
      ? await getD1()
          .prepare(
            `SELECT
              cm.id,
              cm.user_id AS userId,
              cm.role,
              cm.status,
              cm.joined_at AS joinedAt,
              u.name,
              u.email,
              u.avatar_url AS avatarUrl,
              (
                SELECT COUNT(*)
                FROM projects p
                WHERE p.company_id = cm.company_id
                  AND p.created_by_id = cm.user_id
                  AND p.deleted_at IS NULL
              ) AS projectCount
            FROM company_members cm
            INNER JOIN users u ON u.id = cm.user_id
            WHERE cm.company_id = ? AND cm.status = 'active'
            ORDER BY
              CASE cm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
              lower(COALESCE(u.name, u.email)) ASC`
          )
          .bind(company.companyId)
          .all()
      : await getD1()
          .prepare(
            `SELECT
              cm.id,
              cm.user_id AS userId,
              cm.role,
              cm.status,
              cm.joined_at AS joinedAt,
              u.name,
              u.email,
              u.avatar_url AS avatarUrl,
              (
                SELECT COUNT(*)
                FROM projects p
                WHERE p.company_id = cm.company_id
                  AND p.created_by_id = cm.user_id
                  AND p.deleted_at IS NULL
              ) AS projectCount
            FROM company_members cm
            INNER JOIN users u ON u.id = cm.user_id
            WHERE cm.id = ? AND cm.status = 'active'`
          )
          .bind(company.membershipId)
          .all();

    const projectQuery = manager
      ? `SELECT
          p.id,
          p.name,
          p.slug,
          p.status,
          p.dashboard_type AS dashboardType,
          p.created_at AS createdAt,
          p.updated_at AS updatedAt,
          p.published_at AS publishedAt,
          p.owner_id AS ownerId,
          p.created_by_id AS createdById,
          COALESCE(creator.name, creator.email, 'Thành viên đã rời công ty') AS creatorName,
          creator.email AS creatorEmail
        FROM projects p
        LEFT JOIN users creator ON creator.id = p.created_by_id
        WHERE p.company_id = ? AND p.deleted_at IS NULL
        ORDER BY p.updated_at DESC`
      : `SELECT
          p.id,
          p.name,
          p.slug,
          p.status,
          p.dashboard_type AS dashboardType,
          p.created_at AS createdAt,
          p.updated_at AS updatedAt,
          p.published_at AS publishedAt,
          p.owner_id AS ownerId,
          p.created_by_id AS createdById,
          COALESCE(creator.name, creator.email, 'Thành viên') AS creatorName,
          creator.email AS creatorEmail
        FROM projects p
        LEFT JOIN users creator ON creator.id = p.created_by_id
        WHERE p.company_id = ? AND p.owner_id = ? AND p.deleted_at IS NULL
        ORDER BY p.updated_at DESC`;
    const projectStatement = getD1().prepare(projectQuery);
    const projectRows = manager
      ? await projectStatement.bind(company.companyId).all()
      : await projectStatement.bind(company.companyId, auth.user.id).all();

    const invitations = manager
      ? await getD1()
          .prepare(
            `SELECT id, email, role, expires_at AS expiresAt, created_at AS createdAt
             FROM company_invitations
             WHERE company_id = ? AND accepted_at IS NULL AND expires_at > ?
             ORDER BY created_at DESC`
          )
          .bind(company.companyId, new Date().toISOString())
          .all()
      : { results: [] };

    return Response.json({
      company: {
        id: company.companyId,
        name: company.companyName,
        slug: company.companySlug,
        role: company.role,
        canManage: manager,
      },
      members: members.results || [],
      projects: projectRows.results || [],
      invitations: invitations.results || [],
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể tải dữ liệu công ty.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedCompanyContext();
    if (!auth) return unauthorizedCompanyResponse();
    if (!canManageCompany(auth.company.role)) {
      return forbiddenCompanyResponse();
    }
    const payload = (await request.json()) as {
      email?: string;
      role?: unknown;
      sendEmail?: boolean;
    };
    const email = payload.email?.trim().toLowerCase();
    if (!email || !email.includes("@") || !validManagedRole(payload.role)) {
      return Response.json(
        { error: "Email hoặc vai trò nhân viên chưa hợp lệ." },
        { status: 400 }
      );
    }
    await ensureDatabase();

    const alreadyMember = await getD1()
      .prepare(
        `SELECT cm.id
         FROM company_members cm
         INNER JOIN users u ON u.id = cm.user_id
         WHERE cm.company_id = ? AND lower(u.email) = ? AND cm.status = 'active'
         LIMIT 1`
      )
      .bind(auth.company.companyId, email)
      .first();
    if (alreadyMember) {
      return Response.json(
        { error: "Tài khoản này đã là thành viên của công ty." },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const existingInvitation = await getD1()
      .prepare(
        `SELECT id
         FROM company_invitations
         WHERE company_id = ? AND lower(email) = ?
           AND accepted_at IS NULL AND expires_at > ?
         LIMIT 1`
      )
      .bind(auth.company.companyId, email, now)
      .first<{ id: string }>();

    const inviteToken = createOpaqueToken();
    const tokenHash = await hashOpaqueToken(inviteToken);
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();
    const invitationId = existingInvitation?.id || crypto.randomUUID();
    if (existingInvitation) {
      await getD1()
        .prepare(
          `UPDATE company_invitations
           SET role = ?, invited_by = ?, token_hash = ?, expires_at = ?,
               created_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .bind(
          payload.role,
          auth.user.id,
          tokenHash,
          expiresAt,
          invitationId
        )
        .run();
    } else {
      await getD1()
        .prepare(
          `INSERT INTO company_invitations
           (id, company_id, email, role, invited_by, token_hash, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          invitationId,
          auth.company.companyId,
          email,
          payload.role,
          auth.user.id,
          tokenHash,
          expiresAt
        )
        .run();
    }
    await writeCompanyAudit(
      auth.company,
      existingInvitation ? "member.reinvited" : "member.invited",
      "invitation",
      invitationId,
      { email, role: payload.role }
    );
    const relativeInviteUrl = `/company/join/${encodeURIComponent(inviteToken)}`;
    const inviteUrl = new URL(relativeInviteUrl, request.url).toString();
    let emailStatus: "sent" | "not_configured" | "failed" =
      "not_configured";
    let emailError = "";

    if (payload.sendEmail !== false) {
      const roleLabel =
        payload.role === "admin" ? "Quản trị viên" : "Nhân viên";
      const subject = `Lời mời tham gia ${auth.company.companyName} trên Lumo`;
      const body = [
        `Xin chào,`,
        "",
        `${auth.user.name} (${auth.user.email}) đã mời bạn tham gia công ty ${auth.company.companyName} trên Lumo.`,
        `Vai trò: ${roleLabel}`,
        "",
        "Bấm đường dẫn dưới đây để tham gia:",
        inviteUrl,
        "",
        `Hãy đăng nhập Google bằng đúng tài khoản ${email}.`,
        "Lời mời có hiệu lực trong 7 ngày.",
        "",
        "Nếu bạn không mong đợi lời mời này, bạn có thể bỏ qua email.",
      ].join("\r\n");
      const safeInviteUrl = escapeHtml(inviteUrl);
      const htmlBody = [
        '<!doctype html><html lang="vi"><body style="font-family:Arial,sans-serif;color:#173523;line-height:1.6">',
        `<h2>Lời mời tham gia ${escapeHtml(auth.company.companyName)}</h2>`,
        `<p>${escapeHtml(auth.user.name)} (${escapeHtml(auth.user.email)}) đã mời bạn tham gia công ty trên Lumo với vai trò <strong>${escapeHtml(roleLabel)}</strong>.</p>`,
        `<p><a href="${safeInviteUrl}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#173523;color:#fff;text-decoration:none;font-weight:700">Tham gia công ty</a></p>`,
        `<p>Nếu nút không hoạt động, hãy sao chép toàn bộ đường dẫn này:<br><a href="${safeInviteUrl}" style="word-break:break-all">${safeInviteUrl}</a></p>`,
        `<p>Hãy đăng nhập Google bằng đúng tài khoản <strong>${escapeHtml(email)}</strong>. Lời mời có hiệu lực trong 7 ngày.</p>`,
        "</body></html>",
      ].join("");

      try {
        const sentAt = await sendSmtpEmail({
          to: email,
          subject,
          text: body,
          html: htmlBody,
        });
        emailStatus = sentAt ? "sent" : "not_configured";
        if (sentAt) {
          await writeCompanyAudit(
            auth.company,
            "invitation.email_sent",
            "invitation",
            invitationId,
            { email, sentAt }
          );
        }
      } catch (error) {
        emailStatus = "failed";
        emailError =
          error instanceof Error ? error.message : "Không thể gửi email.";
      }
    }

    return Response.json({
      added: false,
      pending: true,
      renewed: Boolean(existingInvitation),
      inviteUrl: relativeInviteUrl,
      emailStatus,
      emailError: emailError || undefined,
      message:
        emailStatus === "sent"
          ? `Đã gửi lời mời đến ${email}.`
          : emailStatus === "failed"
            ? "Đã tạo lời mời nhưng SMTP gửi thất bại. Hãy sao chép đường dẫn dự phòng."
            : "Đã tạo lời mời. SMTP chưa được cấu hình nên hãy dùng đường dẫn dự phòng.",
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể thêm nhân viên.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthenticatedCompanyContext();
    if (!auth) return unauthorizedCompanyResponse();
    if (!canManageCompany(auth.company.role)) {
      return forbiddenCompanyResponse();
    }
    const payload = (await request.json()) as {
      memberId?: string;
      role?: unknown;
    };
    if (!payload.memberId || !validManagedRole(payload.role)) {
      return Response.json(
        { error: "Thành viên hoặc vai trò chưa hợp lệ." },
        { status: 400 }
      );
    }
    const target = await getD1()
      .prepare(
        `SELECT id, user_id, role
         FROM company_members
         WHERE id = ? AND company_id = ? AND status = 'active'
         LIMIT 1`
      )
      .bind(payload.memberId, auth.company.companyId)
      .first<{ id: string; user_id: string; role: string }>();
    if (
      !target ||
      target.user_id === auth.user.id ||
      !canManageMember(auth.company.role, roleOf(target.role))
    ) {
      return forbiddenCompanyResponse();
    }
    await getD1()
      .prepare(
        "UPDATE company_members SET role = ?, updated_at = ? WHERE id = ?"
      )
      .bind(payload.role, new Date().toISOString(), target.id)
      .run();
    await writeCompanyAudit(
      auth.company,
      "member.role_changed",
      "user",
      target.user_id,
      { from: target.role, to: payload.role }
    );
    return Response.json({ updated: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể cập nhật vai trò.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getAuthenticatedCompanyContext();
    if (!auth) return unauthorizedCompanyResponse();
    if (!canManageCompany(auth.company.role)) {
      return forbiddenCompanyResponse();
    }
    const memberId = new URL(request.url).searchParams.get("memberId");
    if (!memberId) {
      return Response.json(
        { error: "Thiếu mã thành viên." },
        { status: 400 }
      );
    }
    const target = await getD1()
      .prepare(
        `SELECT cm.id, cm.user_id, cm.role, u.email, u.name
         FROM company_members cm
         INNER JOIN users u ON u.id = cm.user_id
         WHERE cm.id = ? AND cm.company_id = ? AND cm.status = 'active'
         LIMIT 1`
      )
      .bind(memberId, auth.company.companyId)
      .first<{
        id: string;
        user_id: string;
        role: string;
        email: string;
        name: string | null;
      }>();
    if (
      !target ||
      target.user_id === auth.user.id ||
      !canManageMember(auth.company.role, roleOf(target.role))
    ) {
      return forbiddenCompanyResponse();
    }

    const now = new Date().toISOString();
    await getD1().batch([
      getD1()
        .prepare(
          `UPDATE projects
           SET owner_id = ?, updated_at = ?
           WHERE company_id = ? AND owner_id = ? AND deleted_at IS NULL`
        )
        .bind(
          auth.company.companyOwnerId,
          now,
          auth.company.companyId,
          target.user_id
        ),
      getD1()
        .prepare(
          `UPDATE company_members
           SET status = 'removed', updated_at = ?
           WHERE id = ?`
        )
        .bind(now, target.id),
      getD1()
        .prepare("DELETE FROM auth_sessions WHERE user_id = ?")
        .bind(target.user_id),
    ]);
    await writeCompanyAudit(
      auth.company,
      "member.removed",
      "user",
      target.user_id,
      {
        email: target.email,
        role: target.role,
        projectsTransferredTo: auth.company.companyOwnerId,
      }
    );
    return Response.json({ removed: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể xóa nhân viên.",
      },
      { status: 500 }
    );
  }
}
