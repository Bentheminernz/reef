CREATE TABLE `acknowledged_update_release_note` (
	`nintendo_account_id` text NOT NULL,
	`update_release_note_id` text NOT NULL,
	`read_at` integer NOT NULL,
	PRIMARY KEY(`nintendo_account_id`, `update_release_note_id`),
	FOREIGN KEY (`nintendo_account_id`) REFERENCES `nintendo_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`update_release_note_id`) REFERENCES `update_release_note`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `update_release_note` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL
);
