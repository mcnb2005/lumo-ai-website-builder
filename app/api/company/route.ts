import { ensureDatabase, getD1 } from "../../../db";
import {
  canManageCompany,
  canCreateLanding,
  canManageMember,
  type CompanyRole,
  writeCompanyAudit,
} from "../../company-data";
import {
  forbiddenCompanyResponse,
  getAuthenticatedCompanyContext,
  unauthorizedCompanyResponse,
} from "../../company-access";
import {
  generateTemporaryPassword,
  hashPassword,
} from "../../password-auth";

function validManagedRole(
  value: unknown
): value is "admin" | "member" | "viewer" {
  return value === "admin" || value === "member" || value === "viewer";
}

function roleOf(value: string): CompanyRole {
  return value === "owner" ||
    value === "admin" ||
    value === "member" ||
    value === "viewer"
    ? value
    : "member";
}

const INTERNAL_ACCOUNT_DOMAIN = "lumo.local";
const BULK_ACCOUNT_LIMIT = 100;

type CompanyAuthContext = NonNullable<
  Awaited<ReturnType<typeof getAuthenticatedCompanyContext>>
>;

type ManagedAccountInput = {
  username?: string;
  email?: string;
  name?: string;
  role?: unknown;
};

type ManagedAccountCredential = {
  accountCreated: boolean;
  memberId: string;
  temporaryPassword: string;
  username: string;
  email: string;
  name: string;
};

class CompanyAccountError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

function normalizeUsername(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, ".")
    .replace(/[._-]{2,}/g, ".")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 32);
}

function internalEmailForUsername(username: string) {
  return `${username}@${INTERNAL_ACCOUNT_DOMAIN}`;
}

function textValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function coerceAccountInput(value: unknown): ManagedAccountInput | null {
  if (typeof value === "string") return { username: value };
  if (!value || typeof value !== "object") return null;
  const account = value as Record<string, unknown>;
  return {
    username: textValue(account.username),
    email: textValue(account.email),
    name: textValue(account.name),
    role: account.role,
  };
}

async function createManagedAccount(
  auth: CompanyAuthContext,
  input: ManagedAccountInput,
  fallbackRole?: unknown
): Promise<ManagedAccountCredential> {
  const usernameSource = input.username || input.email || "";
  const username = normalizeUsername(usernameSource);
  const providedEmail = input.email?.trim().toLowerCase();
  const email =
    providedEmail && providedEmail.includes("@")
      ? providedEmail
      : internalEmailForUsername(username);
  const requestedRole = validManagedRole(input.role)
    ? input.role
    : fallbackRole;
  const name = input.name?.trim();
  if (!username || username.length < 3 || !validManagedRole(requestedRole)) {
    throw new CompanyAccountError(
      "Tên đăng nhập hoặc vai trò nhân viên chưa hợp lệ.",
      400
    );
  }
  const role = requestedRole;

  const alreadyMember = await getD1()
    .prepare(
      `SELECT cm.id
       FROM company_members cm
       INNER JOIN users u ON u.id = cm.user_id
       WHERE cm.company_id = ?
         AND (lower(u.username) = ? OR lower(u.email) = ?)
         AND cm.status = 'active'
       LIMIT 1`
    )
    .bind(auth.company.companyId, username, email)
    .first();
  if (alreadyMember) {
    throw new CompanyAccountError(
      "Tài khoản này đã là thành viên của công ty.",
      409
    );
  }

  const now = new Date().toISOString();
  const existingUser = await getD1()
    .prepare(
      `SELECT id, email, username, name
       FROM users
       WHERE lower(username) = ? OR lower(email) = ?
       LIMIT 1`
    )
    .bind(username, email)
    .first<{
      id: string;
      email: string;
      username: string | null;
      name: string | null;
    }>();
  if (existingUser) {
    const otherMembership = await getD1()
      .prepare(
        `SELECT c.name
         FROM company_members cm
         INNER JOIN companies c ON c.id = cm.company_id
         WHERE cm.user_id = ? AND cm.company_id <> ?
           AND cm.status = 'active'
         LIMIT 1`
      )
      .bind(existingUser.id, auth.company.companyId)
      .first<{ name: string }>();
    if (otherMembership) {
      throw new CompanyAccountError(
        `Tài khoản này đang thuộc công ty ${otherMembership.name}.`,
        409
      );
    }
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const userId = existingUser?.id || crypto.randomUUID();
  const accountUsername = existingUser?.username || username;
  const displayName = name || existingUser?.name || accountUsername;
  const membershipId = crypto.randomUUID();

  const statements = [];
  if (existingUser) {
    statements.push(
      getD1()
        .prepare(
          `UPDATE users
           SET username = COALESCE(username, ?),
               name = ?, password_hash = ?, must_change_password = 1,
               password_updated_at = ?, updated_at = ?
           WHERE id = ?`
        )
        .bind(accountUsername, displayName, passwordHash, now, now, userId)
    );
  } else {
    statements.push(
      getD1()
        .prepare(
          `INSERT INTO users
           (id, email, username, name, password_hash, must_change_password,
            password_updated_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`
        )
        .bind(
          userId,
          email,
          accountUsername,
          displayName,
          passwordHash,
          now,
          now,
          now
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
        membershipId,
        auth.company.companyId,
        userId,
        role,
        auth.user.id,
        now,
        now
      )
  );
  await getD1().batch(statements);
  await writeCompanyAudit(
    auth.company,
    existingUser ? "member.account_reset" : "member.account_created",
    "user",
    userId,
    { username: accountUsername, email, role }
  );

  return {
    accountCreated: !existingUser,
    memberId: membershipId,
    temporaryPassword,
    username: accountUsername,
    email,
    name: displayName,
  };
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
              u.username,
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
              CASE cm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'member' THEN 2 ELSE 3 END,
              lower(COALESCE(u.name, u.username, u.email)) ASC`
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
              u.username,
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
          COALESCE(creator.name, creator.username, creator.email, 'Thành viên đã rời công ty') AS creatorName,
          creator.email AS creatorEmail,
          creator.username AS creatorUsername
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
          COALESCE(creator.name, creator.username, creator.email, 'Thành viên') AS creatorName,
          creator.email AS creatorEmail,
          creator.username AS creatorUsername
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
        canCreateLanding: canCreateLanding(company.role),
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
      accounts?: unknown;
      username?: string;
      email?: string;
      name?: string;
      role?: unknown;
    };
    await ensureDatabase();

    if (Array.isArray(payload.accounts)) {
      if (payload.accounts.length > BULK_ACCOUNT_LIMIT) {
        return Response.json(
          { error: `Chỉ tạo tối đa ${BULK_ACCOUNT_LIMIT} tài khoản mỗi lần.` },
          { status: 400 }
        );
      }

      const credentials: ManagedAccountCredential[] = [];
      const failures: Array<{
        index: number;
        username: string;
        error: string;
      }> = [];
      const seenUsernames = new Set<string>();

      for (const [index, rawAccount] of payload.accounts.entries()) {
        const account = coerceAccountInput(rawAccount);
        const usernameLabel =
          account?.username?.trim() ||
          account?.email?.trim() ||
          `Dòng ${index + 1}`;
        if (!account) {
          failures.push({
            index: index + 1,
            username: usernameLabel,
            error: "Dòng này chưa đúng định dạng.",
          });
          continue;
        }

        const normalizedUsername = normalizeUsername(
          account.username || account.email || ""
        );
        if (!normalizedUsername || normalizedUsername.length < 3) {
          failures.push({
            index: index + 1,
            username: usernameLabel,
            error: "Tên đăng nhập chưa hợp lệ.",
          });
          continue;
        }
        if (seenUsernames.has(normalizedUsername)) {
          failures.push({
            index: index + 1,
            username: usernameLabel,
            error: "Tên đăng nhập bị trùng trong danh sách.",
          });
          continue;
        }
        seenUsernames.add(normalizedUsername);

        try {
          credentials.push(
            await createManagedAccount(auth, account, payload.role)
          );
        } catch (error) {
          failures.push({
            index: index + 1,
            username: usernameLabel,
            error:
              error instanceof Error
                ? error.message
                : "Không thể tạo tài khoản.",
          });
        }
      }

      if (!credentials.length) {
        return Response.json(
          {
            error: "Chưa tạo được tài khoản nào.",
            credentials,
            failures,
          },
          { status: 400 }
        );
      }

      return Response.json({
        added: true,
        credentials,
        failures,
        createdCount: credentials.length,
        failedCount: failures.length,
        message: failures.length
          ? `Đã cấp ${credentials.length} tài khoản. ${failures.length} dòng chưa được tạo.`
          : `Đã cấp ${credentials.length} tài khoản.`,
      });
    }

    const credential = await createManagedAccount(auth, payload);
    return Response.json({
      added: true,
      ...credential,
      message: `Đã cấp tài khoản ${credential.username}. Hãy gửi tên đăng nhập và mật khẩu tạm cho nhân viên, rồi yêu cầu đổi mật khẩu khi đăng nhập lần đầu.`,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể thêm nhân viên.",
      },
      { status: error instanceof CompanyAccountError ? error.status : 500 }
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
      action?: string;
      memberId?: string;
      role?: unknown;
    };
    if (!payload.memberId) {
      return Response.json(
        { error: "Thành viên chưa hợp lệ." },
        { status: 400 }
      );
    }
    if (payload.action !== "resetPassword" && !validManagedRole(payload.role)) {
      return Response.json(
        { error: "Vai trò nhân viên chưa hợp lệ." },
        { status: 400 }
      );
    }
    const target = await getD1()
      .prepare(
        `SELECT cm.id, cm.user_id, cm.role, u.username, u.email, u.name
         FROM company_members cm
         INNER JOIN users u ON u.id = cm.user_id
         WHERE cm.id = ? AND cm.company_id = ? AND cm.status = 'active'
         LIMIT 1`
      )
      .bind(payload.memberId, auth.company.companyId)
      .first<{
        id: string;
        user_id: string;
        role: string;
        username: string | null;
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
    if (payload.action === "resetPassword") {
      const temporaryPassword = generateTemporaryPassword();
      const passwordHash = await hashPassword(temporaryPassword);
      const now = new Date().toISOString();
      await getD1()
        .prepare(
          `UPDATE users
           SET password_hash = ?, must_change_password = 1,
               password_updated_at = ?, updated_at = ?
           WHERE id = ?`
        )
        .bind(passwordHash, now, now, target.user_id)
        .run();
      await getD1()
        .prepare("DELETE FROM auth_sessions WHERE user_id = ?")
        .bind(target.user_id)
        .run();
      await writeCompanyAudit(
        auth.company,
        "member.password_reset",
        "user",
        target.user_id,
        { username: target.username, email: target.email }
      );
      return Response.json({
        reset: true,
        temporaryPassword,
        username: target.username || target.email,
        email: target.email,
        name: target.name || target.username || target.email,
        message:
          "Đã tạo lại mật khẩu tạm. Hãy gửi thông tin đăng nhập mới cho nhân viên.",
      });
    }
    await getD1()
      .prepare(
        `UPDATE company_members SET role = ?, updated_at = ? WHERE id = ?`
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
        `SELECT cm.id, cm.user_id, cm.role, u.email, u.username, u.name
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
        username: string | null;
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
        username: target.username,
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
