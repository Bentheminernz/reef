ALTER TABLE `acknowledged_update_release_note` RENAME TO `acknowledged_notices`;--> statement-breakpoint
ALTER TABLE `update_release_note` RENAME TO `notices`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_acknowledged_notices` (
	`nintendo_account_id` text NOT NULL,
	`update_release_note_id` text NOT NULL,
	`read_at` integer NOT NULL,
	PRIMARY KEY(`nintendo_account_id`, `update_release_note_id`),
	FOREIGN KEY (`nintendo_account_id`) REFERENCES `nintendo_accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`update_release_note_id`) REFERENCES `notices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_acknowledged_notices`("nintendo_account_id", "update_release_note_id", "read_at") SELECT "nintendo_account_id", "update_release_note_id", "read_at" FROM `acknowledged_notices`;--> statement-breakpoint
DROP TABLE `acknowledged_notices`;--> statement-breakpoint
ALTER TABLE `__new_acknowledged_notices` RENAME TO `acknowledged_notices`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `notices` ADD `require_acknowledgement` integer DEFAULT false;