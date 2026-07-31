CREATE TABLE IF NOT EXISTS `companies` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `slug` text NOT NULL,
  `owner_id` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `companies_slug_unique`
  ON `companies` (`slug`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `companies_owner_idx`
  ON `companies` (`owner_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `company_members` (
  `id` text PRIMARY KEY NOT NULL,
  `company_id` text NOT NULL,
  `user_id` text NOT NULL,
  `role` text DEFAULT 'member' NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `invited_by` text,
  `joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `company_members_company_user_idx`
  ON `company_members` (`company_id`, `user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `company_members_user_idx`
  ON `company_members` (`user_id`, `status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `company_invitations` (
  `id` text PRIMARY KEY NOT NULL,
  `company_id` text NOT NULL,
  `email` text NOT NULL,
  `role` text DEFAULT 'member' NOT NULL,
  `invited_by` text NOT NULL,
  `token_hash` text NOT NULL,
  `expires_at` text NOT NULL,
  `accepted_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `company_invitations_token_unique`
  ON `company_invitations` (`token_hash`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `company_invitations_email_idx`
  ON `company_invitations` (`email`, `accepted_at`, `expires_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `company_audit_logs` (
  `id` text PRIMARY KEY NOT NULL,
  `company_id` text NOT NULL,
  `actor_user_id` text NOT NULL,
  `action` text NOT NULL,
  `entity_type` text NOT NULL,
  `entity_id` text,
  `metadata` text DEFAULT '{}' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `company_audit_company_idx`
  ON `company_audit_logs` (`company_id`, `created_at`);
