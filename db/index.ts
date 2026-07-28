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
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REFRESH_TOKEN?: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_OAUTH_REDIRECT_URI?: string;
  GOOGLE_TOKEN_ENCRYPTION_KEY?: string;
  GMAIL_SENDER_EMAIL?: string;
  GOOGLE_CALENDAR_ID?: string;
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
        google_sub TEXT UNIQUE,
        avatar_url TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    ),
    binding.prepare(
      `CREATE TABLE IF NOT EXISTS auth_states (
        id TEXT PRIMARY KEY NOT NULL,
        return_to TEXT NOT NULL DEFAULT '/',
        purpose TEXT NOT NULL DEFAULT 'login',
        user_id TEXT,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    ),
    binding.prepare(
      `CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    ),
    binding.prepare(
      `CREATE TABLE IF NOT EXISTS google_connections (
        user_id TEXT PRIMARY KEY NOT NULL,
        encrypted_refresh_token TEXT NOT NULL,
        token_iv TEXT NOT NULL,
        connected_email TEXT NOT NULL,
        scopes TEXT NOT NULL DEFAULT '',
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
        dashboard_type TEXT NOT NULL DEFAULT 'auto',
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
        status TEXT NOT NULL DEFAULT 'new',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    ),
    binding.prepare(
      `CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        product_name TEXT NOT NULL,
        amount INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'vnd',
        status TEXT NOT NULL DEFAULT 'new',
        notes TEXT NOT NULL DEFAULT '',
        confirmation_email_sent_at TEXT,
        calendar_event_id TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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

  const userColumns = await binding
    .prepare("PRAGMA table_info(users)")
    .all<{ name: string }>();
  const userColumnNames = new Set(
    userColumns.results?.map((column) => column.name) || []
  );
  if (!userColumnNames.has("google_sub")) {
    await binding.prepare("ALTER TABLE users ADD COLUMN google_sub TEXT").run();
  }
  if (!userColumnNames.has("avatar_url")) {
    await binding.prepare("ALTER TABLE users ADD COLUMN avatar_url TEXT").run();
  }

  const authStateColumns = await binding
    .prepare("PRAGMA table_info(auth_states)")
    .all<{ name: string }>();
  const authStateColumnNames = new Set(
    authStateColumns.results?.map((column) => column.name) || []
  );
  if (!authStateColumnNames.has("purpose")) {
    await binding
      .prepare(
        "ALTER TABLE auth_states ADD COLUMN purpose TEXT NOT NULL DEFAULT 'login'"
      )
      .run();
  }
  if (!authStateColumnNames.has("user_id")) {
    await binding.prepare("ALTER TABLE auth_states ADD COLUMN user_id TEXT").run();
  }

  const columns = await binding
    .prepare("PRAGMA table_info(projects)")
    .all<{ name: string }>();
  if (!columns.results?.some((column) => column.name === "owner_id")) {
    await binding
      .prepare("ALTER TABLE projects ADD COLUMN owner_id TEXT")
      .run();
  }
  if (!columns.results?.some((column) => column.name === "dashboard_type")) {
    await binding
      .prepare(
        "ALTER TABLE projects ADD COLUMN dashboard_type TEXT NOT NULL DEFAULT 'auto'"
      )
      .run();
  }

  const leadColumns = await binding
    .prepare("PRAGMA table_info(leads)")
    .all<{ name: string }>();
  const leadColumnNames = new Set(
    leadColumns.results?.map((column) => column.name) || []
  );
  if (!leadColumnNames.has("status")) {
    await binding
      .prepare("ALTER TABLE leads ADD COLUMN status TEXT NOT NULL DEFAULT 'new'")
      .run();
  }
  if (!leadColumnNames.has("notes")) {
    await binding
      .prepare("ALTER TABLE leads ADD COLUMN notes TEXT NOT NULL DEFAULT ''")
      .run();
  }
  if (!leadColumnNames.has("updated_at")) {
    await binding
      .prepare("ALTER TABLE leads ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''")
      .run();
  }

  const orderColumns = await binding
    .prepare("PRAGMA table_info(orders)")
    .all<{ name: string }>();
  const orderColumnNames = new Set(
    orderColumns.results?.map((column) => column.name) || []
  );
  if (!orderColumnNames.has("confirmation_email_sent_at")) {
    await binding
      .prepare(
        "ALTER TABLE orders ADD COLUMN confirmation_email_sent_at TEXT"
      )
      .run();
  }
  if (!orderColumnNames.has("calendar_event_id")) {
    await binding
      .prepare("ALTER TABLE orders ADD COLUMN calendar_event_id TEXT")
      .run();
  }

  await binding.batch([
    binding.prepare(
      "CREATE INDEX IF NOT EXISTS projects_slug_idx ON projects (slug)"
    ),
    binding.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_idx ON users (google_sub)"
    ),
    binding.prepare(
      "CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions (user_id)"
    ),
    binding.prepare(
      "CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions (expires_at)"
    ),
    binding.prepare(
      "CREATE INDEX IF NOT EXISTS auth_states_expiry_idx ON auth_states (expires_at)"
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
      "CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (project_id, status)"
    ),
    binding.prepare(
      "CREATE INDEX IF NOT EXISTS orders_project_idx ON orders (project_id)"
    ),
    binding.prepare(
      "CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (project_id, status)"
    ),
    binding.prepare(
      "CREATE INDEX IF NOT EXISTS ai_usage_period_idx ON ai_usage (period)"
    ),
  ]);
}

export function getDb() {
  return drizzle(getD1(), { schema });
}
