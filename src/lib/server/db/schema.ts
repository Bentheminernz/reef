import {
	blob,
	check,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text
} from 'drizzle-orm/sqlite-core';
import { encryptedJson, encryptedString } from './customTypes';
import type { NintendoAccountSessionToken } from 'nxapi/nintendo-account';
import type { CoralAuthData, CurrentUserPermissions } from 'nxapi/coral';
import { randomUUID } from 'node:crypto';
import {
	ActivityPlatform,
	type DiscordActivity,
	type DiscordTokenInfo,
	type PresenceSnapshot
} from '$lib/types/discord-auth';
import type { SplatNet3AuthData } from 'nxapi/splatnet3';
import type { SignupBlockedReason } from '$lib/types/signup';
import { sql } from 'drizzle-orm';

export interface WebviewCookie {
	name: string;
	value: string;
	domain: string;
	path: string;
	hostOnly: boolean;
	secure: boolean;
	httpOnly: boolean;
	expires?: number;
}

export const nintendoAccount = sqliteTable(
	'nintendo_accounts',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => randomUUID()),
		naId: text('na_id').notNull().unique(),
		nsaId: text('nsa_id').unique(),
		nintendoAccountSession: encryptedJson<NintendoAccountSessionToken>('nintendo_accounts')(
			'nintendo_account_session'
		),
		coralAuthData: encryptedJson<CoralAuthData>('nintendo_accounts')('coral_auth_data'),
		systemBotUserId: text('system_bot_user_id').references(() => systemBotUser.id),
		botFriendshipBlocked: integer('bot_friendship_blocked', { mode: 'boolean' })
			.notNull()
			.default(false),
		botFriendshipBlockedReason: text('bot_friendship_blocked_reason').$type<SignupBlockedReason>(),
		accessNintendoAssets: integer('access_nintendo_assets', { mode: 'boolean' })
			.notNull()
			.default(false),
		currentUserPermissions: text('current_user_permissions', {
			mode: 'json'
		}).$type<CurrentUserPermissions>(),
		permissionsSyncedAt: integer('permissions_synced_at', { mode: 'timestamp' }),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [index('nintendo_accounts_system_bot_user_idx').on(table.systemBotUserId)]
);

export const systemBotUser = sqliteTable('system_bot_user', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	naId: text('na_id').notNull().unique(),
	nsaId: text('nsa_id').notNull().unique(),
	nintendoAccountSession: encryptedJson<NintendoAccountSessionToken>('system_bot_user')(
		'nintendo_account_session'
	),
	coralAuthData: encryptedJson<CoralAuthData>('system_bot_user')('coral_auth_data'),
	splatnet3AuthData: encryptedJson<SplatNet3AuthData>('system_bot_user')('splatnet3_auth_data'),
	splatnet3Enabled: integer('splatnet3_enabled', { mode: 'boolean' }),
	allowingRequests: integer('allowing_requests', { mode: 'boolean' }),
	friendCount: integer('friend_count')
});

export const sessions = sqliteTable(
	'sessions',
	{
		id: text('id').primaryKey(),
		nintendoAccountId: text('nintendo_account_id')
			.notNull()
			.references(() => nintendoAccount.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [index('sessions_nintendo_account_idx').on(table.nintendoAccountId)]
);

export const gameWebServiceTokens = sqliteTable(
	'game_web_service_tokens',
	{
		nintendoAccountId: text('nintendo_account_id')
			.notNull()
			.references(() => nintendoAccount.id, { onDelete: 'cascade' }),
		serviceId: integer('service_id').notNull(),
		token: encryptedString('game_web_service_tokens')('token').notNull(),
		expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [
		primaryKey({ columns: [table.nintendoAccountId, table.serviceId] }),
		index('game_web_service_tokens_expiry_idx').on(table.expiresAt)
	]
);

export const gameWebviewSessions = sqliteTable(
	'game_webview_sessions',
	{
		id: text('id').primaryKey(),
		nintendoAccountId: text('nintendo_account_id')
			.notNull()
			.references(() => nintendoAccount.id, { onDelete: 'cascade' }),
		serviceId: integer('service_id').notNull(),
		serviceUri: text('service_uri').notNull(),
		allowedOrigins: text('allowed_origins', { mode: 'json' }).$type<string[]>().notNull(),
		language: text('language').notNull(),
		country: text('country').notNull(),
		cookies: encryptedJson<WebviewCookie[]>('game_webview_sessions')('cookies').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [
		index('game_webview_sessions_account_idx').on(table.nintendoAccountId),
		index('game_webview_sessions_expiry_idx').on(table.expiresAt)
	]
);

export const passkeys = sqliteTable(
	'passkeys',
	{
		id: text('id').primaryKey(),
		nintendoAccountId: text('nintendo_account_id')
			.notNull()
			.references(() => nintendoAccount.id, { onDelete: 'cascade' }),
		publicKey: blob('public_key', { mode: 'buffer' }).notNull(),
		counter: integer('counter').notNull().default(0),
		deviceType: text('device_type').notNull(),
		backedUp: integer('backed_up', { mode: 'boolean' }).notNull(),
		transports: text('transports', { mode: 'json' }).$type<string[]>(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		name: text('name')
	},
	(table) => [index('passkeys_nintendo_account_idx').on(table.nintendoAccountId)]
);

export const discordLinks = sqliteTable(
	'discord_links',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => randomUUID()),
		nintendoAccountId: text('nintendo_account_id')
			.notNull()
			.unique()
			.references(() => nintendoAccount.id, { onDelete: 'cascade' }),
		discordUserId: text('discord_user_id').notNull().unique(),
		discordUsername: text('discord_username').notNull(),
		discordAvatar: text('discord_avatar'),
		discordAuth: encryptedJson<DiscordTokenInfo>('discord_links')('discord_auth').notNull(),
		linkedAt: integer('linked_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [index('discord_links_discord_user_idx').on(table.discordUserId)]
);

export const presenceSessions = sqliteTable('presence_sessions', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	discordLinkId: text('discord_link_id')
		.notNull()
		.unique()
		.references(() => discordLinks.id, { onDelete: 'cascade' }),
	enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
	presence: text('presence', { mode: 'json' }).$type<PresenceSnapshot>(),
	activity: text('activity', { mode: 'json' }).$type<DiscordActivity>(),
	platform: text('platform').$type<ActivityPlatform>().notNull().default(ActivityPlatform.DESKTOP),
	splatnetEnabled: integer('splatnet_enabled', { mode: 'boolean' }).notNull().default(true),
	showWhenInactive: integer('show_when_inactive', { mode: 'boolean' }).notNull().default(false),
	showEShopButton: integer('show_eshop_button', { mode: 'boolean' }).notNull().default(true),
	showFriendCodeButton: integer('show_friend_code_button', { mode: 'boolean' })
		.notNull()
		.default(true),
	discordToken: text('discord_token'),
	publishedAt: integer('published_at', { mode: 'timestamp' }),
	startedAt: integer('started_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	lastSyncedAt: integer('last_synced_at', { mode: 'timestamp' }),
	publishFailures: integer('publish_failures').notNull().default(0),
	lastPublishError: text('last_publish_error'),
	needsReauth: integer('needs_reauth', { mode: 'boolean' }).notNull().default(false)
});

export const dataAccess = sqliteTable(
	'data_access',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => randomUUID()),
		nintendoAccountId: text('nintendo_account_id')
			.notNull()
			.references(() => nintendoAccount.id, { onDelete: 'cascade' }),
		endpoint: text('endpoint').notNull(),
		ok: integer('ok', { mode: 'boolean' }).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [index('data_access_account_time_idx').on(table.nintendoAccountId, table.createdAt)]
);

export const privacyPolicy = sqliteTable('privacy_policy', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	content: text('content').notNull(),
	version: text('version').notNull(),
	enforcementDate: integer('enforcement_date', { mode: 'timestamp' }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const policyAcceptance = sqliteTable(
	'policy_acceptance',
	{
		nintendoAccountId: text('nintendo_account_id')
			.notNull()
			.references(() => nintendoAccount.id, { onDelete: 'cascade' }),
		policyId: text('policy_id')
			.notNull()
			.references(() => privacyPolicy.id, { onDelete: 'cascade' }),
		acceptedAt: integer('accepted_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [primaryKey({ columns: [table.nintendoAccountId, table.policyId] })]
);

export const friendCodeData = sqliteTable('friend_code_data', {
	nintendoAccountId: text('nintendo_account_id')
		.primaryKey()
		.references(() => nintendoAccount.id, { onDelete: 'cascade' }),
	friendCode: text('friend_code').notNull(),
	friendCodeURL: text('friend_code_url').notNull(),
	linkId: text('link_id'),
	generatedAt: integer('generated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const notice = sqliteTable('notices', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => randomUUID()),
	title: text('title').notNull().default(''),
	content: text('content').notNull(),
	requireAcknowledgement: integer('require_acknowledgement', { mode: 'boolean' }).default(false),
	category: text('category', { enum: ['News', 'Update', 'Maintenance', 'Other'] })
		.notNull()
		.default('Update'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

export const acknowledgedNotice = sqliteTable(
	'acknowledged_notices',
	{
		nintendoAccountId: text('nintendo_account_id')
			.notNull()
			.references(() => nintendoAccount.id, { onDelete: 'cascade' }),
		noticeId: text('update_release_note_id')
			.notNull()
			.references(() => notice.id, { onDelete: 'cascade' }),
		readAt: integer('read_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [primaryKey({ columns: [table.nintendoAccountId, table.noticeId] })]
);

export const siteSetting = sqliteTable(
	'site_settings',
	{
		id: integer('id').primaryKey().default(1),
		signUpEnabled: integer('sign_up_enabled', { mode: 'boolean' }).notNull().default(false),
		discordEnrolmentEnabled: integer('discord_enrolment_enabled', { mode: 'boolean' })
			.notNull()
			.default(false),
		discordEnrolmentLimit: integer('discord_enrolment_limit').notNull().default(100),
		discordInviteLink: text('discord_invite_link')
			.notNull()
			.default('https://discord.gg/bmCyVeF6Vw')
	},
	(table) => [check('site_settings_singleton', sql`${table.id} = 1`)]
);
