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
  AUTH_SESSION_COOKIE,
  googleSignInPath,
  hashOpaqueToken,
  readCookie,
} from "./google-auth";

export type DatabaseUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  isLocal?: boolean;
};

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
        "SELECT user_id, expires_at FROM auth_sessions WHERE id = ? LIMIT 1"
      )
      .bind(sessionHash)
      .first<{ user_id: string; expires_at: string }>();

    if (session?.expires_at && session.expires_at > now) {
      const [user] = await getDb()
        .select()
        .from(users)
        .where(eq(users.id, session.user_id))
        .limit(1);
      if (user) {
        return {
          id: user.id,
          email: user.email,
          name: user.name || user.email,
          avatarUrl: user.avatarUrl,
        };
      }
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
      return {
        id: existing.id,
        email,
        name,
        avatarUrl: existing.avatarUrl,
        isLocal: true,
      };
    }

    const id = crypto.randomUUID();
    await db.insert(users).values({
      id,
      email,
      name,
      updatedAt: now,
    });
    return { id, email, name, isLocal: true };
  }

  return null;
}

export async function requireCurrentDatabaseUser(returnTo: string) {
  const user = await getCurrentDatabaseUser();
  if (user) return user;
  redirect(googleSignInPath(returnTo));
}
