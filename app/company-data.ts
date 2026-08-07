import { getD1 } from "../db";

export type CompanyRole = "owner" | "admin" | "member" | "viewer";

export type CompanyContext = {
  companyId: string;
  companyName: string;
  companySlug: string;
  companyOwnerId: string;
  membershipId: string;
  role: CompanyRole;
  userId: string;
};

type CompanyUser = {
  id: string;
  email: string;
  name: string;
};

type MembershipRow = {
  company_id: string;
  company_name: string;
  company_slug: string;
  company_owner_id: string;
  membership_id: string;
  role: string;
  user_id: string;
};

function asRole(value: string): CompanyRole {
  return value === "owner" ||
    value === "admin" ||
    value === "member" ||
    value === "viewer"
    ? value
    : "member";
}

function toContext(row: MembershipRow): CompanyContext {
  return {
    companyId: row.company_id,
    companyName: row.company_name,
    companySlug: row.company_slug,
    companyOwnerId: row.company_owner_id,
    membershipId: row.membership_id,
    role: asRole(row.role),
    userId: row.user_id,
  };
}

function companySlug(name: string, id: string) {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "cong-ty"}-${id.slice(0, 8)}`;
}

async function readMembership(userId: string) {
  return getD1()
    .prepare(
      `SELECT
        c.id AS company_id,
        c.name AS company_name,
        c.slug AS company_slug,
        c.owner_id AS company_owner_id,
        cm.id AS membership_id,
        cm.role AS role,
        cm.user_id AS user_id
      FROM company_members cm
      INNER JOIN companies c ON c.id = cm.company_id
      WHERE cm.user_id = ? AND cm.status = 'active'
      ORDER BY CASE cm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'member' THEN 2 ELSE 3 END,
        cm.created_at ASC
      LIMIT 1`
    )
    .bind(userId)
    .first<MembershipRow>();
}

export async function getExistingCompanyForUser(
  user: CompanyUser
): Promise<CompanyContext | null> {
  const membership = await readMembership(user.id);
  return membership ? toContext(membership) : null;
}

export async function ensureCompanyForUser(
  user: CompanyUser
): Promise<CompanyContext> {
  const existingMembership = await readMembership(user.id);
  if (existingMembership) {
    await getD1()
      .prepare(
        `UPDATE projects
         SET company_id = ?
         WHERE owner_id = ? AND company_id IS NULL`
      )
      .bind(existingMembership.company_id, user.id)
      .run();
    return toContext(existingMembership);
  }

  const now = new Date().toISOString();
  const ownedCompany = await getD1()
    .prepare(
      `SELECT id, name, slug, owner_id
       FROM companies
       WHERE owner_id = ?
       ORDER BY created_at ASC
       LIMIT 1`
    )
    .bind(user.id)
    .first<{
      id: string;
      name: string;
      slug: string;
      owner_id: string;
    }>();

  const companyId = ownedCompany?.id || crypto.randomUUID();
  const membershipId = crypto.randomUUID();
  const companyName = ownedCompany?.name || `Công ty của ${user.name}`;
  const slug = ownedCompany?.slug || companySlug(companyName, companyId);

  const statements = [];
  if (!ownedCompany) {
    statements.push(
      getD1()
        .prepare(
          `INSERT INTO companies
           (id, name, slug, owner_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(companyId, companyName, slug, user.id, now, now)
    );
  }
  statements.push(
    getD1()
      .prepare(
        `INSERT INTO company_members
         (id, company_id, user_id, role, status, joined_at, updated_at)
         VALUES (?, ?, ?, 'owner', 'active', ?, ?)
         ON CONFLICT(company_id, user_id) DO UPDATE SET
           role = 'owner',
           status = 'active',
           joined_at = excluded.joined_at,
           updated_at = excluded.updated_at`
      )
      .bind(membershipId, companyId, user.id, now, now),
    getD1()
      .prepare(
        `UPDATE projects
         SET company_id = ?
         WHERE owner_id = ? AND company_id IS NULL`
      )
      .bind(companyId, user.id)
  );
  await getD1().batch(statements);

  const createdMembership = await readMembership(user.id);
  if (!createdMembership) {
    throw new Error("Không thể khởi tạo công ty cho tài khoản.");
  }
  return toContext(createdMembership);
}

export async function getCompanyContextForUser(
  user: CompanyUser
): Promise<CompanyContext> {
  return ensureCompanyForUser(user);
}

export function canManageCompany(role: CompanyRole) {
  return role === "owner" || role === "admin";
}

export function canCreateLanding(role: CompanyRole) {
  return role === "owner" || role === "admin" || role === "member";
}

export function canEditLanding(role: CompanyRole) {
  return canCreateLanding(role);
}

export function canPublishLanding(role: CompanyRole) {
  return canCreateLanding(role);
}

export function canManageMember(
  actorRole: CompanyRole,
  targetRole: CompanyRole
) {
  if (actorRole === "owner") return targetRole !== "owner";
  return (
    actorRole === "admin" &&
    (targetRole === "member" || targetRole === "viewer")
  );
}

export async function writeCompanyAudit(
  context: CompanyContext,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {}
) {
  await getD1()
    .prepare(
      `INSERT INTO company_audit_logs
       (id, company_id, actor_user_id, action, entity_type, entity_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      context.companyId,
      context.userId,
      action,
      entityType,
      entityId,
      JSON.stringify(metadata)
    )
    .run();
}
