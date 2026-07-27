import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export type RuntimeEnv = {
  DB?: D1Database;
  AI_API_KEY?: string;
  AI_PROVIDER_URL?: string;
  AI_MODEL_NAME?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};

export function getRuntimeEnv() {
  return env as unknown as RuntimeEnv;
}

export function getD1() {
  const binding = getRuntimeEnv().DB;
  if (!binding) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB`."
    );
  }
  return binding;
}

export async function ensureDatabase() {
  const binding = getD1();
  await binding.batch([
    binding
      .prepare(
        `CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          data TEXT NOT NULL,
          messages TEXT NOT NULL DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'draft',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          published_at TEXT
        )`
      ),
    binding.prepare(
      "CREATE INDEX IF NOT EXISTS projects_slug_idx ON projects (slug)"
    ),
  ]);
}

export function getDb() {
  return drizzle(getD1(), { schema });
}
