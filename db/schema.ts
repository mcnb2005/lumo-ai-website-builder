import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").unique(),
  name: text("name"),
  googleSub: text("google_sub").unique(),
  avatarUrl: text("avatar_url"),
  passwordHash: text("password_hash"),
  mustChangePassword: integer("must_change_password", {
    mode: "boolean",
  })
    .notNull()
    .default(false),
  passwordUpdatedAt: text("password_updated_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const companies = sqliteTable("companies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const companyMembers = sqliteTable(
  "company_members",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").notNull().default("member"),
    status: text("status").notNull().default("active"),
    invitedBy: text("invited_by").references(() => users.id),
    joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("company_members_company_user_idx").on(
      table.companyId,
      table.userId
    ),
  ]
);

export const companyInvitations = sqliteTable("company_invitations", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id),
  email: text("email").notNull(),
  role: text("role").notNull().default("member"),
  invitedBy: text("invited_by")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  acceptedAt: text("accepted_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const companyAuditLogs = sqliteTable("company_audit_logs", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id),
  actorUserId: text("actor_user_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  metadata: text("metadata").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const authStates = sqliteTable("auth_states", {
  id: text("id").primaryKey(),
  returnTo: text("return_to").notNull().default("/"),
  purpose: text("purpose").notNull().default("login"),
  userId: text("user_id"),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const authSessions = sqliteTable("auth_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const googleConnections = sqliteTable("google_connections", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
  tokenIv: text("token_iv").notNull(),
  connectedEmail: text("connected_email").notNull(),
  scopes: text("scopes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").references(() => users.id),
  createdById: text("created_by_id").references(() => users.id),
  companyId: text("company_id").references(() => companies.id),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  data: text("data").notNull(),
  messages: text("messages").notNull().default("[]"),
  status: text("status").notNull().default("draft"),
  dashboardType: text("dashboard_type").notNull().default("auto"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  publishedAt: text("published_at"),
  deletedAt: text("deleted_at"),
});

export const assets = sqliteTable("assets", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  objectKey: text("object_key").notNull().unique(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const leads = sqliteTable("leads", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  payload: text("payload").notNull(),
  status: text("status").notNull().default("new"),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  payload: text("payload").notNull(),
  productName: text("product_name").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("vnd"),
  status: text("status").notNull().default("new"),
  notes: text("notes").notNull().default(""),
  confirmationEmailSentAt: text("confirmation_email_sent_at"),
  calendarEventId: text("calendar_event_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const aiUsage = sqliteTable("ai_usage", {
  key: text("key").primaryKey(),
  period: text("period").notNull(),
  count: integer("count").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
