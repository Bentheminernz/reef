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
	enabled: boolean;
	presence: PresenceSnapshot | null;
	activity: DiscordActivity | null;
	publishedAt: Date | null;
	startedAt: Date;
	lastSyncedAt: Date | null;
	platform: ActivityPlatform;
	splatnetEnabled: boolean;
	showWhenInactive: boolean;
	showEShopButton: boolean;
	showFriendCodeButton: boolean;
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

export type UserPermissionsSummary = CurrentUserPermissions;

export type {
	PasskeySummary,
	DiscordLinkSummary,
	PresenceSessionSummary,
	DataAccessLogSummary,
	SiteSettingsSummary,
	VisibleSystemBotInfo
};
