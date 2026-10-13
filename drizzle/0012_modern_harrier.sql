ALTER TABLE `presence_sessions` ADD `show_when_inactive` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `presence_sessions` ADD `show_eshop_button` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `presence_sessions` ADD `show_friend_code_button` integer DEFAULT false NOT NULL;