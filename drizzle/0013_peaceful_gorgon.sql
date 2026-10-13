PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_presence_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`discord_link_id` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`presence` text,
	`activity` text,
	`platform` text DEFAULT 'desktop' NOT NULL,
	`splatnet_enabled` integer DEFAULT true NOT NULL,
	`show_when_inactive` integer DEFAULT false NOT NULL,
	`show_eshop_button` integer DEFAULT true NOT NULL,
	`show_friend_code_button` integer DEFAULT true NOT NULL,
	`discord_token` text,
	`published_at` integer,
	`started_at` integer NOT NULL,
	`last_synced_at` integer,
	FOREIGN KEY (`discord_link_id`) REFERENCES `discord_links`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_presence_sessions`("id", "discord_link_id", "enabled", "presence", "activity", "platform", "splatnet_enabled", "show_when_inactive", "show_eshop_button", "show_friend_code_button", "discord_token", "published_at", "started_at", "last_synced_at") SELECT "id", "discord_link_id", "enabled", "presence", "activity", "platform", "splatnet_enabled", "show_when_inactive", "show_eshop_button", "show_friend_code_button", "discord_token", "published_at", "started_at", "last_synced_at" FROM `presence_sessions`;--> statement-breakpoint
DROP TABLE `presence_sessions`;--> statement-breakpoint
ALTER TABLE `__new_presence_sessions` RENAME TO `presence_sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `presence_sessions_discord_link_id_unique` ON `presence_sessions` (`discord_link_id`);