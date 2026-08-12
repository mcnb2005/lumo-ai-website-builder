import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ensureDatabase,
  getD1,
  getDb,
  getRuntimeEnv,
} from "../db";
import { users } from "../db/schema";
import {
  getExistingCompanyForUser,
  type CompanyRole,
} from "./company-data";
import {
  AUTH_SESSION_COOKIE,
  hashOpaqueToken,
  readCookie,
  safeRelativeReturnPath,
} from "./google-auth";

export type DatabaseUser = {
  id: string;
  email: string;
  username?: string | null;
  name: string;
  avatarUrl?: string | null;
  isLocal?: boolean;
  mustChangePassword?: boolean;
  companyId?: string;
  companyName?: string;
  companyRole?: CompanyRole;
};

async function withCompany(user: DatabaseUser): Promise<DatabaseUser> {
  const company = await getExistingCompanyForUser(user);
  if (!company) return user;
  return {
    ...user,
    companyId: company.companyId,
    companyName: company.companyName,
    companyRole: company.role,
  };
}

export async function getCurrentDatabaseUser(): Promise<DatabaseUser | null> {
  await ensureDatabase();
  const requestHeaders = await headers();
  const sessionToken = readCookie(
    requestHeaders.get("cookie"),
    AUTH_SESSION_COOKIE
  );

  if (sessionToken) {
    const now = new Date().toISOString();
    const sessionHash = await hashOpaqueToken(sessionToken);
    const session = await getD1()
      .prepare(
        `SELECT
          session.expires_at,
          user.id,
          user.email,
          user.username,
          user.name,
          user.avatar_url,
          user.must_change_password,
          company.id AS company_id,
          company.name AS company_name,
          membership.role AS company_role
         FROM auth_sessions session
         INNER JOIN users user ON user.id = session.user_id
         LEFT JOIN company_members membership
           ON membership.user_id = user.id AND membership.status = 'active'
         LEFT JOIN companies company ON company.id = membership.company_id
         WHERE session.id = ?
         ORDER BY
           CASE membership.role
             WHEN 'owner' THEN 0
             WHEN 'admin' THEN 1
             WHEN 'member' THEN 2
             ELSE 3
           END,
           membership.created_at ASC
         LIMIT 1`
      )
      .bind(sessionHash)
      .first<{
        expires_at: string;
        id: string;
        email: string;
        username: string | null;
        name: string | null;
        avatar_url: string | null;
        must_change_password: number;
        company_id: string | null;
        company_name: string | null;
        company_role: string | null;
      }>();

    if (session?.expires_at && session.expires_at > now) {
      const companyRole =
        session.company_role === "owner" ||
        session.company_role === "admin" ||
        session.company_role === "member" ||
        session.company_role === "viewer"
          ? session.company_role
          : undefined;
      return {
        id: session.id,
        email: session.email,
        username: session.username,
        name: session.name || session.username || session.email,
        avatarUrl: session.avatar_url,
        mustChangePassword: Boolean(session.must_change_password),
        companyId: session.company_id || undefined,
        companyName: session.company_name || undefined,
        companyRole,
      };
    } else if (session) {
      await getD1()
        .prepare("DELETE FROM auth_sessions WHERE id = ?")
        .bind(sessionHash)
        .run();
    }
  }

  const runtime = getRuntimeEnv();
  if (runtime.LOCAL_DEV_AUTH === "true" && runtime.LOCAL_DEV_USER_EMAIL) {
    const email = runtime.LOCAL_DEV_USER_EMAIL.trim().toLowerCase();
    const name = runtime.LOCAL_DEV_USER_NAME?.trim() || "Chủ máy";
    const db = getDb();
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    const now = new Date().toISOString();
    if (existing) {
      if (existing.name !== name) {
        await db
          .update(users)
          .set({ name, updatedAt: now })
          .where(eq(users.id, existing.id));
      }
      return withCompany({
        id: existing.id,
        email,
        username: existing.username,
        name,
        avatarUrl: existing.avatarUrl,
        isLocal: true,
        mustChangePassword: Boolean(existing.mustChangePassword),
      });
    }

    const id = crypto.randomUUID();
    await db.insert(users).values({
      id,
      email,
      name,
      updatedAt: now,
    });
    return withCompany({ id, email, name, isLocal: true });
  }

  return null;
}

export async function requireCurrentDatabaseUser(returnTo: string) {
  const user = await getCurrentDatabaseUser();
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  if (user?.mustChangePassword) {
    redirect(`/account/password?returnTo=${encodeURIComponent(safeReturnTo)}`);
  }
  if (user) return user;
  redirect(`/login?returnTo=${encodeURIComponent(safeReturnTo)}`);
}
