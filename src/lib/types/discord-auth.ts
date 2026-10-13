import type { PresencePlatform, PresenceState } from 'nxapi/coral';

interface DiscordTokenResponse {
	token_type: string;
	access_token: string;
	expires_in: number;
	refresh_token: string;
	scope: string;
	id_token: string;
}

interface DiscordTokenInfo extends DiscordTokenResponse {
	expires_time: number;
}

interface DiscordUserResponse {
	id: string;
	username: string;
	discriminator: string;
	global_name: string | null;
	avatar: string | null;
	email?: string;
	verified?: boolean;
}

enum ActivityPlatform {
	DESKTOP = 'desktop',
	XBOX = 'xbox',
	IOS = 'ios',
	EMBEDDED = 'embedded',
	PS5 = 'ps5',
	META_QUEST = 'meta_quest'
}

enum ActivityType {
	PLAYING = 0,
	STREAMING = 1,
	LISTENING = 2,
	WATCHING = 3,
	CUSTOM = 4,
	COMPETING = 5,
	HANG = 6
}

interface DiscordActivity {
	name: string;
	state?: string;
	state_url?: string;
	type: ActivityType;
	application_id: string;
	details?: string;
	details_url?: string;
	platform: ActivityPlatform;
	timestamps?: {
		start?: number;
		end?: number;
	};
	assets?: {
		large_image?: string;
		large_text?: string;
		large_url?: string;
		small_image?: string;
		small_text?: string;
		small_url?: string;
	};
	buttons?: {
		label: string;
		url: string;
	}[];
	instance?: boolean;
}

interface DiscordHeadlessActivityResponse {
	name: string;
	application_id: string;
	parent_application_id?: string;
	type: ActivityType;
	platform: ActivityPlatform;
	assets: {
		large_text?: string;
		large_image: string;
		small_text?: string;
		small_image?: string;
	};
	state: string;
	buttons?: string[];
	metadata: {
		button_urls?: string[];
	};
	flags: number;
	session_id: string;
}

interface DiscordHeadlessResponse {
	token: string;
	activities: DiscordHeadlessActivityResponse[];
}

interface PresenceGameSnapshot {
	name: string;
	imageUri: string;
	shopUri: string;
	totalPlayTime: number;
	firstPlayedAt: number;
}

interface PresenceUserSnapshot {
	name: string;
	imageUri: string;
}

interface PresenceSnapshot {
	state: PresenceState;
	updatedAt: number;
	logoutAt: number;
	platform: PresencePlatform | null;
	user: PresenceUserSnapshot | null;
	game: PresenceGameSnapshot | null;
}

export type {
	DiscordTokenResponse,
	DiscordTokenInfo,
	DiscordUserResponse,
	DiscordActivity,
	DiscordHeadlessActivityResponse,
	DiscordHeadlessResponse,
	PresenceGameSnapshot,
	PresenceUserSnapshot,
	PresenceSnapshot
};

export { ActivityPlatform };
