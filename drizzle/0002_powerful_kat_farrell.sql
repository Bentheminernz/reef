DROP TABLE IF EXISTS `friend_code_data`;--> statement-breakpoint
CREATE TABLE `friend_code_data` (
	`nintendo_account_id` text PRIMARY KEY NOT NULL,
	`friend_code` text NOT NULL,
	`friend_code_url` text NOT NULL,
	`link_id` text,
	`generated_at` integer NOT NULL,
	FOREIGN KEY (`nintendo_account_id`) REFERENCES `nintendo_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);