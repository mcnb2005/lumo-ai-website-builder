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
  AI_FALLBACK_PROVIDER_URL?: string;
  AI_FALLBACK_MODEL_NAME?: string;
  AI_FALLBACK_API_KEY?: string;
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
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_SECURE?: string;
  SMTP_STARTTLS?: string;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  SMTP_AUTH_METHOD?: string;
  SMTP_FROM_EMAIL?: string;
  SMTP_FROM_NAME?: string;
  SMTP_HELO_NAME?: string;
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

let databaseReady: Promise<void> | null = null;

const REQUIRED_INDEXES = [
  "projects_slug_idx",
  "users_google_sub_idx",
  "users_username_idx",
  "auth_sessions_user_idx",
  "auth_sessions_expiry_idx",
  "auth_states_expiry_idx",
  "projects_owner_idx",
  "projects_company_idx",
  "projects_creator_idx",
  "companies_owner_idx",
  "company_members_company_user_idx",
  "company_members_user_idx",
  "company_invitations_email_idx",
  "company_audit_company_idx",
  "assets_project_idx",
  "leads_project_idx",
  "leads_status_idx",
  "orders_project_idx",
  "orders_status_idx",
  "ai_usage_period_idx",
] as const;

async function databaseSchemaIsCurrent(binding: D1Database) {
  await binding
    .prepare(
      `SELECT
        u.username,
        u.google_sub,
        u.avatar_url,
        u.password_hash,
        u.must_change_password,
        u.password_updated_at,
        auth_state.purpose,
        auth_state.user_id,
        project.owner_id,
        project.created_by_id,
        project.company_id,
        project.dashboard_type,
        project.deleted_at,
        lead.status,
        lead.notes,
        lead.updated_at,
        order_row.confirmation_email_sent_at,
        order_row.calendar_event_id
       FROM users u
       CROSS JOIN auth_states auth_state
       CROSS JOIN projects project
       CROSS JOIN leads lead
       CROSS JOIN orders order_row
       CROSS JOIN companies company
       CROSS JOIN company_members company_member
       CROSS JOIN company_invitations company_invitation
       CROSS JOIN company_audit_logs company_audit
       CROSS JOIN auth_sessions auth_session
       CROSS JOIN google_connections google_connection
       CROSS JOIN assets asset
       CROSS JOIN ai_usage usage
       LIMIT 0`
    )
    .all();

  const placeholders = REQUIRED_INDEXES.map(() => "?").join(", ");
  const indexResult = await binding
    .prepare(
      `SELECT COUNT(*) AS index_count
       FROM sqlite_master
       WHERE type = 'index' AND name IN (${placeholders})`
    )
    .bind(...REQUIRED_INDEXES)
    .first<{ index_count: number }>();

  return Number(indexResult?.index_count || 0) === REQUIRED_INDEXES.length;
}

async function initializeDatabaseCompatibility(binding: D1Database) {

  await binding.batch([
    binding.prepare(
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        email TEXT NOT NULL UNIQUE,
        username TEXT UNIQUE,
        name TEXT,
        google_sub TEXT UNIQUE,
        avatar_url TEXT,
        password_hash TEXT,
        must_change_password INTEGER NOT NULL DEFAULT 0,
        password_updated_at TEXT,
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
      `CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        owner_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    ),
    binding.prepare(
      `CREATE TABLE IF NOT EXISTS company_members (
        id TEXT PRIMARY KEY NOT NULL,
        company_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        status TEXT NOT NULL DEFAULT 'active',
        invited_by TEXT,
        joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    ),
    binding.prepare(
      `CREATE TABLE IF NOT EXISTS company_invitations (
        id TEXT PRIMARY KEY NOT NULL,
        company_id TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        invited_by TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        accepted_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    ),
    binding.prepare(
      `CREATE TABLE IF NOT EXISTS company_audit_logs (
        id TEXT PRIMARY KEY NOT NULL,
        company_id TEXT NOT NULL,
        actor_user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        metadata TEXT NOT NULL DEFAULT '{}',
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
        created_by_id TEXT,
        company_id TEXT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        data TEXT NOT NULL,
        messages TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'draft',
        dashboard_type TEXT NOT NULL DEFAULT 'auto',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        published_at TEXT,
        deleted_at TEXT
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
  if (!userColumnNames.has("username")) {
    await binding.prepare("ALTER TABLE users ADD COLUMN username TEXT").run();
  }
  if (!userColumnNames.has("avatar_url")) {
    await binding.prepare("ALTER TABLE users ADD COLUMN avatar_url TEXT").run();
  }
  if (!userColumnNames.has("password_hash")) {
    await binding.prepare("ALTER TABLE users ADD COLUMN password_hash TEXT").run();
  }
  if (!userColumnNames.has("must_change_password")) {
    await binding
      .prepare(
        "ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0"
      )
      .run();
  }
  if (!userColumnNames.has("password_updated_at")) {
    await binding
      .prepare("ALTER TABLE users ADD COLUMN password_updated_at TEXT")
      .run();
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
  if (!columns.results?.some((column) => column.name === "company_id")) {
    await binding.prepare("ALTER TABLE projects ADD COLUMN company_id TEXT").run();
  }
  if (!columns.results?.some((column) => column.name === "created_by_id")) {
    await binding
      .prepare("ALTER TABLE projects ADD COLUMN created_by_id TEXT")
      .run();
    await binding
      .prepare(
        "UPDATE projects SET created_by_id = owner_id WHERE created_by_id IS NULL"
      )
      .run();
  }
  if (!columns.results?.some((column) => column.name === "deleted_at")) {
    await binding.prepare("ALTER TABLE projects ADD COLUMN deleted_at TEXT").run();
  }
  await binding
    .prepare(
      "UPDATE projects SET dashboard_type = 'leads' WHERE dashboard_type = 'bookings'"
    )
    .run();

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
      "CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON users (username)"
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
      "CREATE INDEX IF NOT EXISTS projects_company_idx ON projects (company_id, deleted_at)"
    ),
    binding.prepare(
      "CREATE INDEX IF NOT EXISTS projects_creator_idx ON projects (created_by_id, deleted_at)"
    ),
    binding.prepare(
      "CREATE INDEX IF NOT EXISTS companies_owner_idx ON companies (owner_id)"
    ),
    binding.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS company_members_company_user_idx ON company_members (company_id, user_id)"
    ),
    binding.prepare(
      "CREATE INDEX IF NOT EXISTS company_members_user_idx ON company_members (user_id, status)"
    ),
    binding.prepare(
      "CREATE INDEX IF NOT EXISTS company_invitations_email_idx ON company_invitations (email, accepted_at, expires_at)"
    ),
    binding.prepare(
      "CREATE INDEX IF NOT EXISTS company_audit_company_idx ON company_audit_logs (company_id, created_at)"
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

export async function ensureDatabase() {
  if (!databaseReady) {
    const binding = getD1();
    const initialization = (async () => {
      let schemaIsCurrent = false;
      try {
        schemaIsCurrent = await databaseSchemaIsCurrent(binding);
      } catch {
        // A new or older database falls back to the compatibility initializer.
      }
      if (!schemaIsCurrent) {
        await initializeDatabaseCompatibility(binding);
      }
    })();
    databaseReady = initialization;
  }

  const initialization = databaseReady;
  try {
    await initialization;
  } catch (error) {
    if (databaseReady === initialization) databaseReady = null;
    throw error;
  }
}

export function getDb() {
  return drizzle(getD1(), { schema });
}
