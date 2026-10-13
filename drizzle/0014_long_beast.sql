PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_nintendo_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`na_id` text NOT NULL,
	`nsa_id` text,
	`nintendo_account_session` blob,
	`coral_auth_data` blob,
	`system_bot_user_id` text,
	`bot_friendship_blocked` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`system_bot_user_id`) REFERENCES `system_bot_user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_nintendo_accounts`("id", "na_id", "nsa_id", "nintendo_account_session", "coral_auth_data", "system_bot_user_id", "bot_friendship_blocked", "created_at") SELECT "id", "na_id", "nsa_id", "nintendo_account_session", "coral_auth_data", "system_bot_user_id", "bot_friendship_blocked", COALESCE((SELECT MIN(`accepted_at`) FROM `policy_acceptance` WHERE `policy_acceptance`.`nintendo_account_id` = `nintendo_accounts`.`id`), unixepoch()) FROM `nintendo_accounts`;--> statement-breakpoint
DROP TABLE `nintendo_accounts`;--> statement-breakpoint
ALTER TABLE `__new_nintendo_accounts` RENAME TO `nintendo_accounts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `nintendo_accounts_na_id_unique` ON `nintendo_accounts` (`na_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `nintendo_accounts_nsa_id_unique` ON `nintendo_accounts` (`nsa_id`);--> statement-breakpoint
CREATE INDEX `nintendo_accounts_system_bot_user_idx` ON `nintendo_accounts` (`system_bot_user_id`);