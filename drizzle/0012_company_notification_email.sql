ALTER TABLE `companies` ADD `notification_email` text;
--> statement-breakpoint
ALTER TABLE `companies` ADD `notification_email_verified_at` text;
--> statement-breakpoint
CREATE TABLE `company_notification_email_verifications` (
  `company_id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `code_hash` text NOT NULL,
  `attempt_count` integer DEFAULT 0 NOT NULL,
  `expires_at` text NOT NULL,
  `last_sent_at` text NOT NULL,
  `requested_by` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `company_notification_email_verifications_expiry_idx`
  ON `company_notification_email_verifications` (`expires_at`);
