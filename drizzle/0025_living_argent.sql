ALTER TABLE `presence_sessions` ADD `presence_mode` text DEFAULT 'in_game' NOT NULL;--> statement-breakpoint
ALTER TABLE `presence_sessions` ADD `eshop_button` text DEFAULT 'both' NOT NULL;--> statement-breakpoint
ALTER TABLE `presence_sessions` ADD `friend_button` text DEFAULT 'both' NOT NULL;--> statement-breakpoint
ALTER TABLE `presence_sessions` ADD `show_playtime` integer DEFAULT true NOT NULL;--> statement-breakpoint
UPDATE `presence_sessions` SET
	`presence_mode` = CASE
		WHEN `enabled` = 0 THEN 'disabled'
		WHEN `show_when_inactive` = 1 THEN 'always'
		ELSE 'in_game'
	END,
	`eshop_button` = CASE
		WHEN `show_eshop_button` = 1 THEN 'both'
		ELSE 'game_icon'
	END,
	`friend_button` = CASE
		WHEN `show_friend_code_button` = 1 THEN 'both'
		ELSE 'user_icon'
	END;--> statement-breakpoint
ALTER TABLE `presence_sessions` DROP COLUMN `enabled`;--> statement-breakpoint
ALTER TABLE `presence_sessions` DROP COLUMN `show_when_inactive`;--> statement-breakpoint
ALTER TABLE `presence_sessions` DROP COLUMN `show_eshop_button`;--> statement-breakpoint
ALTER TABLE `presence_sessions` DROP COLUMN `show_friend_code_button`;
