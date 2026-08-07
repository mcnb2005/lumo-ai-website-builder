ALTER TABLE `users` ADD COLUMN `password_hash` text;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `must_change_password` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `password_updated_at` text;
