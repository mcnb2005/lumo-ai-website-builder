import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

type AssetBucket = {
  put(
    key: string,
    value: ReadableStream<Uint8Array>,
    options?: { httpMetadata?: { contentType?: string } }
  ): Promise<unknown>;
  get(key: string): Promise<{
    body: ReadableStream<Uint8Array>;
    httpEtag: string;
  } | null>;
};

export type RuntimeEnv = {
  DB?: D1Database;
  ASSETS?: AssetBucket;
  AI_API_KEY?: string;
  AI_PROVIDER_URL?: string;
  AI_MODEL_NAME?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  LOCAL_DEV_AUTH?: string;
  LOCAL_DEV_USER_EMAIL?: string;
  LOCAL_DEV_USER_NAME?: string;
};

export function getRuntimeEnv() {
  return env as unknown as RuntimeEnv;
}

export function getD1() {
  const binding = getRuntimeEnv().DB;
  if (!binding) {
    throw new Error("Kho dữ liệu chưa sẵn sàng.");
  }
  return binding;
}

export function getAssetsBucket() {
  const binding = getRuntimeEnv().ASSETS;
  if (!binding) {
    throw new Error("Kho lưu ảnh chưa được cấu hình.");
  }
  return binding;
}

export async function ensureDatabase() {
  const binding = getD1();

  await binding.batch([
    binding.prepare(
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        email TEXT NOT NULL UNIQUE,
        name TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    ),
    binding.prepare(
      `CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY NOT NULL,
        owner_id TEXT,
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
      `CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        object_key TEXT NOT NULL UNIQUE,
        filename TEXT NOT NULL,
        content_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    ),
    binding.prepare(
      `CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    ),
    binding.prepare(
      `CREATE TABLE IF NOT EXISTS ai_usage (
        key TEXT PRIMARY KEY NOT NULL,
        period TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    ),
  ]);

  const columns = await binding
    .prepare("PRAGMA table_info(projects)")
    .all<{ name: string }>();
  if (!columns.results?.some((column) => column.name === "owner_id")) {
    await binding
      .prepare("ALTER TABLE projects ADD COLUMN owner_id TEXT")
      .run();
  }

  await binding.batch([
    binding.prepare(
      "CREATE INDEX IF NOT EXISTS projects_slug_idx ON projects (slug)"
    ),
    binding.prepare(
      "CREATE INDEX IF NOT EXISTS projects_owner_idx ON projects (owner_id)"
    ),
    binding.prepare(
      "CREATE INDEX IF NOT EXISTS assets_project_idx ON assets (project_id)"
    ),
    binding.prepare(
      "CREATE INDEX IF NOT EXISTS leads_project_idx ON leads (project_id)"
    ),
    binding.prepare(
      "CREATE INDEX IF NOT EXISTS ai_usage_period_idx ON ai_usage (period)"
    ),
  ]);
}

export function getDb() {
  return drizzle(getD1(), { schema });
}
