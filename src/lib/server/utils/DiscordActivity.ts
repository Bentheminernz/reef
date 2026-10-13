import { PresencePlatform, PresenceState, type Friend_4 } from 'nxapi/coral';
import {
	ActivityPlatform,
	type DiscordActivity,
	type PresenceGameSnapshot,
	type PresenceSnapshot
} from '$lib/types/discord-auth';
import { formatPlayTime } from '$lib/utils/playTime';
import getTitleIdFromEcUrl from '$lib/utils/getTitleIdFromEcUrl';
import { isClassicId } from '$lib/types/nintendo';

export function buildPresenceSnapshot(friend: Friend_4): PresenceSnapshot {
	const presence = friend.presence;
	const online =
		presence.state === PresenceState.PLAYING || presence.state === PresenceState.ONLINE;

	return {
		state: presence.state,
		updatedAt: presence.updatedAt,
		logoutAt: presence.logoutAt,
		platform: online ? presence.platform : null,
		user: {
			name: friend.name,
			imageUri: friend.imageUri
		},
		game: online
			? {
					name: presence.game.name,
					imageUri: presence.game.imageUri,
					shopUri: presence.game.shopUri,
					totalPlayTime: presence.game.totalPlayTime,
					firstPlayedAt: presence.game.firstPlayedAt
				}
			: null
	};
}

export function mergePresenceSnapshot(
	previous: PresenceSnapshot | null | undefined,
	friend: Friend_4
): PresenceSnapshot {
	const next = buildPresenceSnapshot(friend);

	if (next.game == null && previous?.game != null) {
		next.game = previous.game;
	}

	return next;
}

export interface DiscordActivityOptions {
	showWhenInactive: boolean;
	showEShopButton: boolean;
	showFriendCodeButton: boolean;
}

export function buildDiscordActivity(
	friend: Friend_4,
	applicationId: string,
	platform: ActivityPlatform = ActivityPlatform.DESKTOP,
	friendCodeURI?: string,
	options?: Partial<DiscordActivityOptions>
): DiscordActivity | null {
	const {
		showWhenInactive = false,
		showEShopButton = true,
		showFriendCodeButton = false
	} = options ?? {};

	const presence = friend.presence;

	if (presence.state === PresenceState.PLAYING || presence.state === PresenceState.ONLINE) {
		const game = presence.game;

		const titleId = getTitleIdFromEcUrl(game.shopUri);
		const gameUri = `https://fancy.org.uk/api/nxapi/title/${titleId}/redirect?source=Reef`;
		const playTime = formatPlayTime(game.totalPlayTime, game.firstPlayedAt);
		const sysDescription = game.sysDescription.trim() === '' ? null : game.sysDescription;

		const classicGameName =
			titleId != null &&
			isClassicId(titleId) &&
			sysDescription != null &&
			/^playing:\s*/i.test(sysDescription.trim())
				? sysDescription.trim().replace(/^playing:\s*/i, '')
				: null;

		const activity: DiscordActivity = {
			name: classicGameName ?? game.name,
			application_id: applicationId,
			platform: platform,
			type: 0,
			details: classicGameName != null ? game.name : (sysDescription ?? playTime),
			details_url: gameUri,
			state:
				sysDescription != null
					? playTime
					: presence.platform == PresencePlatform.NX
						? 'Nintendo Switch'
						: 'Nintendo Switch 2',
			state_url: gameUri,
			assets: {
				large_image: game.imageUri,
				large_text: `${game.name} | RPC by Reef`,
				small_image: friend.imageUri,
				small_text: friend.name
			}
		};

		const buttons: NonNullable<DiscordActivity['buttons']> = [];

		if (showFriendCodeButton && friendCodeURI) {
			buttons.push({ label: 'Send Friend Request', url: friendCodeURI });
		}
		if (showEShopButton) {
			buttons.push({ label: 'View on the eShop', url: gameUri });
		}

		if (buttons.length > 0) {
			activity.buttons = buttons;
		}

		return activity;
	}

	if (presence.state === PresenceState.INACTIVE) {
		if (!showWhenInactive) {
			return null;
		}

		const activity: DiscordActivity = {
			name: 'Online',
			application_id: applicationId,
			platform: platform,
			type: 0,
			details: 'Nintendo Switch',
			assets: {
				small_image: friend.imageUri,
				small_text: `${friend.name} | RPC by Reef`
			}
		};

		if (showFriendCodeButton && friendCodeURI) {
			activity.buttons = [
				{
					label: 'Send Friend Request',
					url: friendCodeURI
				}
			];
		}

		return activity;
	}

	return null;
}

export function getGameKey(game: PresenceGameSnapshot | null | undefined): string | null {
	return game?.shopUri ?? game?.name ?? null;
}

const MAX_CARRY_MS = 6 * 60 * 60 * 1000;

export function applyActivityStart(
	activity: DiscordActivity,
	previousGameKey: string | null,
	currentGameKey: string | null,
	startedAt: Date
): Date {
	const sameGame = currentGameKey != null && currentGameKey === previousGameKey;

	const carriedMs = startedAt instanceof Date ? startedAt.getTime() : NaN;
	const stale = Number.isNaN(carriedMs) || Date.now() - carriedMs > MAX_CARRY_MS;

	const nextStartedAt = sameGame && !stale ? startedAt : new Date();

	activity.timestamps = { start: nextStartedAt.getTime() };

	return nextStartedAt;
}
