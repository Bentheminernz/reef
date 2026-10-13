ALTER TABLE `presence_sessions` ADD `publish_failures` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `presence_sessions` ADD `last_publish_error` text;--> statement-breakpoint
ALTER TABLE `presence_sessions` ADD `needs_reauth` integer DEFAULT false NOT NULL;