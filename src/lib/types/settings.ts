import type { ActivityPlatform, DiscordActivity, PresenceSnapshot } from './discord-auth';
import type { CurrentUserPermissions } from 'nxapi/coral';

interface PasskeySummary {
	id: string;
	name: string | null;
	deviceType: string;
	backedUp: boolean;
	transports: string[] | null;
	createdAt: Date;
}

interface DiscordLinkSummary {
	id: string;
	discordUserId: string;
	discordUsername: string;
	discordAvatar: string | null;
	linkedAt: Date;
}

interface PresenceSessionSummary {
	id: string;
	presence: PresenceSnapshot | null;
	presenceMode: 'disabled' | 'in_game' | 'always';
	activity: DiscordActivity | null;
	publishedAt: Date | null;
	startedAt: Date;
	lastSyncedAt: Date | null;
	platform: ActivityPlatform;
	splatnetEnabled: boolean;
	eShopButton: 'disabled' | 'game_icon' | 'btn' | 'both';
	friendButton: 'disabled' | 'user_icon' | 'btn' | 'both';
	showPlaytime: boolean;
	publishFailures: number;
	lastPublishError: string | null;
	needsReauth: boolean;
}

interface DataAccessLogSummary {
	id: string;
	endpoint: string;
	ok: boolean;
	createdAt: Date;
}

interface SiteSettingsSummary {
	signUpEnabled: boolean;
	discordEnrolmentEnabled: boolean;
	discordEnrolmentLimit: number;
	discordInviteLink: string;
}

interface VisibleSystemBotInfo {
	id: string;
	nsaId: string;
	name: string;
	imageUri: string;
	webServices: {
		splatnet3: boolean;
	};
}

export interface UserPermissionsSummary {
	coral: CurrentUserPermissions;
	reef: {
		allowDiscordUsernameSearching: boolean;
	};
}

export type {
	PasskeySummary,
	DiscordLinkSummary,
	PresenceSessionSummary,
	DataAccessLogSummary,
	SiteSettingsSummary,
	VisibleSystemBotInfo
};
