CREATE TABLE IF NOT EXISTS `record_notifications` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `record_type` text NOT NULL,
  `record_id` text NOT NULL,
  `recipient_email` text,
  `status` text DEFAULT 'pending' NOT NULL,
  `attempt_count` integer DEFAULT 0 NOT NULL,
  `last_error` text,
  `last_attempt_at` text,
  `sent_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `record_notifications_record_idx`
  ON `record_notifications` (`record_type`, `record_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `record_notifications_project_idx`
  ON `record_notifications` (`project_id`, `status`);
