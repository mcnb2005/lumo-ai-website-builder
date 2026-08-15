ALTER TABLE `users` ADD `deleted_at` text;
--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD `user_agent` text;
--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD `last_seen_at` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD `publish_settings` text DEFAULT '{}' NOT NULL;
--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `expires_at` text NOT NULL,
  `used_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `password_reset_tokens_user_idx`
  ON `password_reset_tokens` (`user_id`);
--> statement-breakpoint
CREATE INDEX `password_reset_tokens_expiry_idx`
  ON `password_reset_tokens` (`expires_at`);
--> statement-breakpoint
CREATE TABLE `auth_login_attempts` (
  `key` text PRIMARY KEY NOT NULL,
  `attempt_count` integer DEFAULT 0 NOT NULL,
  `window_started_at` text NOT NULL,
  `locked_until` text,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `project_slug_redirects` (
  `slug` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `project_slug_redirects_project_idx`
  ON `project_slug_redirects` (`project_id`);
--> statement-breakpoint
CREATE TABLE `project_versions` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `version_number` integer NOT NULL,
  `reason` text DEFAULT 'autosave' NOT NULL,
  `data` text NOT NULL,
  `messages` text DEFAULT '[]' NOT NULL,
  `publish_settings` text DEFAULT '{}' NOT NULL,
  `created_by_id` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_versions_project_number_idx`
  ON `project_versions` (`project_id`, `version_number`);
--> statement-breakpoint
CREATE INDEX `project_versions_project_created_idx`
  ON `project_versions` (`project_id`, `created_at`);
--> statement-breakpoint
PRAGMA optimize;
