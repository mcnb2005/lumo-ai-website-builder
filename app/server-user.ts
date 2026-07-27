import { eq } from "drizzle-orm";
import { ensureDatabase, getDb } from "../db";
import { users } from "../db/schema";
import { getChatGPTUser } from "./chatgpt-auth";

export type DatabaseUser = {
  id: string;
  email: string;
  name: string;
};

export async function getCurrentDatabaseUser(): Promise<DatabaseUser | null> {
  const identity = await getChatGPTUser();
  if (!identity) return null;

  await ensureDatabase();
  const db = getDb();
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, identity.email))
    .limit(1);
  const name = identity.fullName || identity.displayName || identity.email;
  const now = new Date().toISOString();

  if (existing) {
    if (existing.name !== name) {
      await db
        .update(users)
        .set({ name, updatedAt: now })
        .where(eq(users.id, existing.id));
    }
    return { id: existing.id, email: existing.email, name };
  }

  const id = crypto.randomUUID();
  await db.insert(users).values({
    id,
    email: identity.email,
    name,
    updatedAt: now,
  });
  return { id, email: identity.email, name };
}
