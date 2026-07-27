ALTER TABLE `leads` ADD `status` text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `updated_at` text DEFAULT '' NOT NULL;
