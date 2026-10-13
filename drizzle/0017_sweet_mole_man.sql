CREATE TABLE `site_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`sign_up_enabled` integer DEFAULT false NOT NULL,
	`sign_up_limit` integer DEFAULT 100 NOT NULL,
	CONSTRAINT "site_settings_singleton" CHECK("site_settings"."id" = 1)
);
