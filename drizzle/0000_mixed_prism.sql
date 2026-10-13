CREATE TABLE `data_access` (
	`id` text PRIMARY KEY NOT NULL,
	`nintendo_account_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`ok` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`nintendo_account_id`) REFERENCES `nintendo_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `data_access_account_time_idx` ON `data_access` (`nintendo_account_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `discord_links` (
	`id` text PRIMARY KEY NOT NULL,
	`nintendo_account_id` text NOT NULL,
	`discord_user_id` text NOT NULL,
	`discord_username` text NOT NULL,
	`discord_avatar` text,
	`discord_auth` blob NOT NULL,
	`linked_at` integer NOT NULL,
	FOREIGN KEY (`nintendo_account_id`) REFERENCES `nintendo_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discord_links_nintendo_account_id_unique` ON `discord_links` (`nintendo_account_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `discord_links_discord_user_id_unique` ON `discord_links` (`discord_user_id`);--> statement-breakpoint
CREATE INDEX `discord_links_discord_user_idx` ON `discord_links` (`discord_user_id`);--> statement-breakpoint
CREATE TABLE `game_web_service_tokens` (
	`nintendo_account_id` text NOT NULL,
	`service_id` integer NOT NULL,
	`token` blob NOT NULL,
	`expires_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`nintendo_account_id`, `service_id`),
	FOREIGN KEY (`nintendo_account_id`) REFERENCES `nintendo_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `game_web_service_tokens_expiry_idx` ON `game_web_service_tokens` (`expires_at`);--> statement-breakpoint
CREATE TABLE `game_webview_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`nintendo_account_id` text NOT NULL,
	`service_id` integer NOT NULL,
	`service_uri` text NOT NULL,
	`allowed_origins` text NOT NULL,
	`language` text NOT NULL,
	`country` text NOT NULL,
	`cookies` blob NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`nintendo_account_id`) REFERENCES `nintendo_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `game_webview_sessions_account_idx` ON `game_webview_sessions` (`nintendo_account_id`);--> statement-breakpoint
CREATE INDEX `game_webview_sessions_expiry_idx` ON `game_webview_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `nintendo_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`na_id` text NOT NULL,
	`nsa_id` text,
	`nintendo_account_session` blob,
	`coral_auth_data` blob,
	`system_bot_user_id` text,
	FOREIGN KEY (`system_bot_user_id`) REFERENCES `system_bot_user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nintendo_accounts_na_id_unique` ON `nintendo_accounts` (`na_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `nintendo_accounts_nsa_id_unique` ON `nintendo_accounts` (`nsa_id`);--> statement-breakpoint
CREATE INDEX `nintendo_accounts_system_bot_user_idx` ON `nintendo_accounts` (`system_bot_user_id`);--> statement-breakpoint
CREATE TABLE `passkeys` (
	`id` text PRIMARY KEY NOT NULL,
	`nintendo_account_id` text NOT NULL,
	`public_key` blob NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL,
	`device_type` text NOT NULL,
	`backed_up` integer NOT NULL,
	`transports` text,
	`created_at` integer NOT NULL,
	`name` text,
	FOREIGN KEY (`nintendo_account_id`) REFERENCES `nintendo_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `passkeys_nintendo_account_idx` ON `passkeys` (`nintendo_account_id`);--> statement-breakpoint
CREATE TABLE `policy_acceptance` (
	`nintendo_account_id` text NOT NULL,
	`policy_id` text NOT NULL,
	`accepted_at` integer NOT NULL,
	PRIMARY KEY(`nintendo_account_id`, `policy_id`),
	FOREIGN KEY (`nintendo_account_id`) REFERENCES `nintendo_accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`policy_id`) REFERENCES `privacy_policy`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `presence_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`discord_link_id` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`presence` text,
	`activity` text,
	`discord_token` text,
	`published_at` integer,
	`started_at` integer NOT NULL,
	`last_synced_at` integer,
	FOREIGN KEY (`discord_link_id`) REFERENCES `discord_links`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `presence_sessions_discord_link_id_unique` ON `presence_sessions` (`discord_link_id`);--> statement-breakpoint
CREATE TABLE `privacy_policy` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`version` text NOT NULL,
	`enforcement_date` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`nintendo_account_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`nintendo_account_id`) REFERENCES `nintendo_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_nintendo_account_idx` ON `sessions` (`nintendo_account_id`);--> statement-breakpoint
CREATE TABLE `system_bot_user` (
	`id` text PRIMARY KEY NOT NULL,
	`na_id` text NOT NULL,
	`nsa_id` text NOT NULL,
	`nintendo_account_session` blob,
	`coral_auth_data` blob,
	`allowing_requests` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `system_bot_user_na_id_unique` ON `system_bot_user` (`na_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `system_bot_user_nsa_id_unique` ON `system_bot_user` (`nsa_id`);