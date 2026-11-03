import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions } from './$types';
import { db } from '$lib/server/db';
import {
	discordLinks,
	friendCodeData,
	presenceSessions,
	sessions,
	siteSetting,
	systemBotUser
} from '$lib/server/db/schema';
import { verifySession } from '$lib/server/session';
import {
	createDiscordHeadlessSession,
	DiscordApiError,
	endDiscordHeadlessSession,
	updateDiscordHeadlessSession
} from '$lib/server/utils/DiscordAuth';
import {
	applyActivityStart,
	buildDiscordActivity,
	getGameKey,
	mergePresenceSnapshot
} from '$lib/server/utils/DiscordActivity';
import { getSystemBotCoralApi } from '$lib/server/coral';
import { ActivityPlatform } from '$lib/types/discord-auth';
import { isAdmin } from '$lib/server/admin';

export const actions: Actions = {
	signOut: async ({ cookies }) => {
		const token = cookies.get('session');
		if (token) {
			const sessionId = await verifySession(token);
			if (sessionId) await db.delete(sessions).where(eq(sessions.id, sessionId));
		}

		cookies.delete('session', { path: '/' });
		redirect(303, '/login');
	},
	setSync: async ({ request, locals }) => {
		if (!locals.nintendoAccount) {
			error(401, 'Unauthenticated.');
		}

		const user = locals.nintendoAccount;
		const formData = await request.formData();

		const presenceModeField = formData.get('presenceMode');
		const platformField = formData.get('platform');
		const splatnetEnabledField = formData.get('splatnetEnabled');
		const eShopButtonField = formData.get('eShopButton');
		const friendButtonField = formData.get('friendButton');
		const showPlaytimeField = formData.get('showPlaytime');

		const presenceModes = ['disabled', 'in_game', 'always'] as const;
		const eShopButtonModes = ['disabled', 'game_icon', 'btn', 'both'] as const;
		const friendButtonModes = ['disabled', 'user_icon', 'btn', 'both'] as const;

		const presenceMode =
			presenceModeField == null
				? undefined
				: presenceModes.find((mode) => mode === presenceModeField);
		const eShopButton =
			eShopButtonField == null
				? undefined
				: eShopButtonModes.find((mode) => mode === eShopButtonField);
		const friendButton =
			friendButtonField == null
				? undefined
				: friendButtonModes.find((mode) => mode === friendButtonField);
		const splatnetEnabled =
			splatnetEnabledField == null ? undefined : splatnetEnabledField === 'true';
		const showPlaytime = showPlaytimeField == null ? undefined : showPlaytimeField === 'true';
		const platform =
			platformField == null
				? undefined
				: (Object.values(ActivityPlatform).find((p) => p === platformField) ??
					ActivityPlatform.DESKTOP);

		if (
			presenceMode === undefined &&
			platform === undefined &&
			splatnetEnabled === undefined &&
			eShopButton === undefined &&
			friendButton === undefined &&
			showPlaytime === undefined
		) {
			return error(400, 'Nothing to update.');
		}

		const discordLink = await db
			.select()
			.from(discordLinks)
			.where(eq(discordLinks.nintendoAccountId, user.id))
			.get();

		if (discordLink == null) {
			return error(400, 'No discord');
		}

		const set: Partial<typeof presenceSessions.$inferInsert> = {};
		if (presenceMode !== undefined) set.presenceMode = presenceMode;
		if (platform !== undefined) set.platform = platform;
		if (splatnetEnabled !== undefined) set.splatnetEnabled = splatnetEnabled;
		if (eShopButton !== undefined) set.eShopButton = eShopButton;
		if (friendButton !== undefined) set.friendButton = friendButton;
		if (showPlaytime !== undefined) set.showPlaytime = showPlaytime;

		const [presenceSession] = await db
			.insert(presenceSessions)
			.values({
				discordLinkId: discordLink.id,
				presenceMode: presenceMode ?? 'in_game',
				platform: platform ?? ActivityPlatform.DESKTOP,
				splatnetEnabled: splatnetEnabled ?? true,
				eShopButton: eShopButton ?? 'both',
				friendButton: friendButton ?? 'both',
				showPlaytime: showPlaytime ?? true
			})
			.onConflictDoUpdate({
				target: presenceSessions.discordLinkId,
				set
			})
			.returning();

		if (presenceSession?.presenceMode === 'disabled') {
			await endDiscordHeadlessSession(discordLink.id);
			return;
		}

		if (presenceSession?.needsReauth) {
			return fail(400, {
				message: 'Discord publishing is paused until you reconnect your account.'
			});
		}

		if (presenceMode === undefined && presenceSession?.discordToken == null) return;

		const systemBotUserId = user.systemBotUserId;

		if (systemBotUserId == null) {
			return error(400, 'No system bot assigned');
		}

		const applicationId = process.env.DISCORD_CLIENT_ID;

		if (applicationId == null) {
			return error(400, 'No Discord client');
		}

		const systemBot = await db
			.select()
			.from(systemBotUser)
			.where(eq(systemBotUser.id, systemBotUserId))
			.get();

		if (systemBot == null) {
			return error(400, 'No system bot found');
		}

		const systemCoral = await getSystemBotCoralApi(systemBot.id);
		const friendList = await systemCoral.getFriendList();
		const friend = friendList.friends.find((f) => f.nsaId === user.nsaId);

		if (friend == null) {
			return;
		}

		const presence = mergePresenceSnapshot(presenceSession?.presence, friend);

		const friendCode = await db
			.select()
			.from(friendCodeData)
			.where(eq(friendCodeData.nintendoAccountId, user.id))
			.get();

		const activity = buildDiscordActivity(
			friend,
			applicationId,
			platform,
			friendCode?.friendCodeURL,
			{
				showWhenInactive: presenceSession.presenceMode === 'always',
				eShopButton: presenceSession.eShopButton,
				friendCodeButton: presenceSession.friendButton,
				showPlaytime: presenceSession.showPlaytime
			}
		);

		if (activity == null) {
			await endDiscordHeadlessSession(discordLink.id);
			return;
		}

		const previousGameKey =
			presenceSession?.discordToken != null ? getGameKey(presenceSession?.presence?.game) : null;
		const activityStartedAt = applyActivityStart(
			activity,
			previousGameKey,
			getGameKey(presence.game),
			presenceSession?.startedAt ?? new Date()
		);

		await db
			.update(presenceSessions)
			.set({ presence, startedAt: activityStartedAt, lastSyncedAt: new Date() })
			.where(eq(presenceSessions.id, presenceSession.id));

		if (presenceSession.discordToken != null) {
			try {
				await updateDiscordHeadlessSession(discordLink.id, activity);
			} catch (error) {
				if (!(error instanceof DiscordApiError && error.kind === 'session')) throw error;

				await createDiscordHeadlessSession(discordLink.id, activity);
			}
		} else {
			await createDiscordHeadlessSession(discordLink.id, activity);
		}
	},
	updateAdminSettings: async ({ request, locals }) => {
		if (!locals.nintendoAccount) {
			console.error('Unauthenticated user calling updateAdminSettings');
			throw error(400, 'Bad Request');
		}

		if (!isAdmin(locals.nintendoAccount.naId)) {
			console.error('Regular user calling Update Admin settings');
			throw error(400, 'Bad Request');
		}

		const formData = await request.formData();
		const signUpEnabled = formData.get('signUpEnabled') === 'true';
		const discordEnrolmentEnabled = formData.get('discordEnrolmentEnabled') === 'true';
		const discordEnrolmentLimitField = formData.get('discordEnrolmentLimit');
		const discordEnrolmentLimit =
			discordEnrolmentLimitField == null ? 100 : Number(discordEnrolmentLimitField);

		if (!Number.isInteger(discordEnrolmentLimit) || discordEnrolmentLimit < 0) {
			console.error('Invalid Request for Update Adming Setting');
			return fail(400, { message: 'Enrolment limit must be a whole number of 0 or more.' });
		}

		const discordInviteLinkField = formData.get('discordInviteLink');
		const discordInviteLink =
			typeof discordInviteLinkField === 'string' ? discordInviteLinkField.trim() : '';

		if (!/^https?:\/\//i.test(discordInviteLink)) {
			console.error('Invalid discord invite link in Update Admin Settings');
			return fail(400, { message: 'Discord invite link must start with https:// or http://.' });
		}

		const [updated] = await db
			.insert(siteSetting)
			.values({ signUpEnabled, discordEnrolmentEnabled, discordEnrolmentLimit, discordInviteLink })
			.onConflictDoUpdate({
				target: siteSetting.id,
				set: { signUpEnabled, discordEnrolmentEnabled, discordEnrolmentLimit, discordInviteLink }
			})
			.returning();

		return { success: true, adminSettings: updated };
	}
};
