CREATE TABLE `ai_usage_events` (
  `id` text PRIMARY KEY NOT NULL,
  `key` text NOT NULL,
  `user_id` text NOT NULL,
  `company_id` text NOT NULL,
  `project_id` text,
  `period` text NOT NULL,
  `provider_models` text DEFAULT '[]' NOT NULL,
  `prompt_tokens` integer,
  `completion_tokens` integer,
  `total_tokens` integer,
  `token_usage_complete` integer DEFAULT 0 NOT NULL,
  `cost_micros` integer,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ai_usage_events_key_period_idx`
  ON `ai_usage_events` (`key`, `period`, `created_at`);
--> statement-breakpoint
PRAGMA optimize;
