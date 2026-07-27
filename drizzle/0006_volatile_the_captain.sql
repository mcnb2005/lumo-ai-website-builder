DROP INDEX IF EXISTS `orders_stripe_session_idx`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `payment_status`;--> statement-breakpoint
ALTER TABLE `orders` DROP COLUMN `stripe_session_id`;
