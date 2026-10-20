import { redirect } from '@sveltejs/kit';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';
import {
	getCoralApi,
	getCoralFriends,
	getCoralMedia,
	getCoralNotifications,
	getCoralShowSelf,
	getCoralWebServices
} from '$lib/server/coral';
import { db } from '$lib/server/db';
import { renderMarkdown } from '$lib/server/markdown';
import {
	acknowledgedNotice,
	dataAccess,
	discordLinks,
	notice,
	passkeys,
	presenceSessions,
	siteSetting,
	systemBotUser
} from '$lib/server/db/schema';
import type { VisibleSystemBotInfo } from '$lib/types/settings';
import type { CoralSvelteNotice, Notification } from '$lib/types/notifications';
import { isAdmin } from '$lib/server/admin';

function parseStoredTimestamp(value: number | string): Date {
	return new Date(typeof value === 'number' ? value * 1000 : value);
}

const DISCORD_LINK_ERROR_MESSAGES: Record<string, string> = {
	'friend-limit':
		"You're at Nintendo's 300-friend limit, so we couldn't add our system user. Remove a friend on your Switch, then link Discord again.",
	'requests-disabled':
		"Friend requests are turned off on your Nintendo account, so we couldn't add our system user. Turn them on, then link Discord again.",
	'no-capacity':
		'Reef has no room for new Discord presence users right now. Please try again later.',
	unassigned: "We couldn't add our system user to your friends list. Please try again in a moment."
};

export const load = (async ({ locals, depends, isDataRequest, url }) => {
	if (!locals.nintendoAccount) {
		throw redirect(302, '/login');
	}

	depends('app:passkeys');
	depends('app:media');
	depends('app:notices');

	const coral = await getCoralApi(locals.nintendoAccount);
	const friends = getCoralFriends(locals.nintendoAccount, coral);
	const media = getCoralMedia(locals.nintendoAccount, coral);
	const webServices = getCoralWebServices(locals.nintendoAccount, coral);
	const userInfo = getCoralShowSelf(locals.nintendoAccount, coral);
	const notifications = getCoralNotifications(locals.nintendoAccount, coral).then((items) =>
		Promise.all(
			items.map(async (notification): Promise<Notification> => {
				if (notification.type !== 'OPERATION') {
					return notification;
				}

				return {
					...notification,
					contentHtml: await renderMarkdown(notification.operation.contents)
				};
			})
		)
	);

	const registeredPasskeys = await db
		.select({
			id: passkeys.id,
			name: passkeys.name,
			deviceType: passkeys.deviceType,
			backedUp: passkeys.backedUp,
			transports: passkeys.transports,
			createdAt: passkeys.createdAt
		})
		.from(passkeys)
		.where(eq(passkeys.nintendoAccountId, locals.nintendoAccount.id))
		.orderBy(desc(passkeys.createdAt));

	const linkedDiscordAccount = await db
		.select({
			id: discordLinks.id,
			discordUserId: discordLinks.discordUserId,
			discordUsername: discordLinks.discordUsername,
			discordAvatar: discordLinks.discordAvatar,
			linkedAt: discordLinks.linkedAt
		})
		.from(discordLinks)
		.where(eq(discordLinks.nintendoAccountId, locals.nintendoAccount.id))
		.get();

	const presenceSession = linkedDiscordAccount
		? await db
				.select({
					id: presenceSessions.id,
					enabled: presenceSessions.enabled,
					presence: presenceSessions.presence,
					activity: presenceSessions.activity,
					publishedAt: presenceSessions.publishedAt,
					startedAt: presenceSessions.startedAt,
					lastSyncedAt: presenceSessions.lastSyncedAt,
					platform: presenceSessions.platform,
					splatnetEnabled: presenceSessions.splatnetEnabled,
					showWhenInactive: presenceSessions.showWhenInactive,
					showEShopButton: presenceSessions.showEShopButton,
					showFriendCodeButton: presenceSessions.showFriendCodeButton,
					publishFailures: presenceSessions.publishFailures,
					lastPublishError: presenceSessions.lastPublishError,
					needsReauth: presenceSessions.needsReauth
				})
				.from(presenceSessions)
				.where(eq(presenceSessions.discordLinkId, linkedDiscordAccount.id))
				.get()
		: undefined;

	const dataAccessLogs = await db
		.select({
			id: dataAccess.id,
			endpoint: dataAccess.endpoint,
			ok: dataAccess.ok,
			createdAt: dataAccess.createdAt
		})
		.from(dataAccess)
		.where(eq(dataAccess.nintendoAccountId, locals.nintendoAccount.id))
		.orderBy(desc(dataAccess.createdAt))
		.limit(50);

	const systemBotUserId = locals.nintendoAccount.systemBotUserId;
	const assignedSystemBot =
		systemBotUserId == null
			? null
			: await db.select().from(systemBotUser).where(eq(systemBotUser.id, systemBotUserId)).get();

	let visibleSystemBotInfo: VisibleSystemBotInfo | null = null;

	if (assignedSystemBot != null && assignedSystemBot.coralAuthData != null) {
		visibleSystemBotInfo = {
			id: assignedSystemBot.id,
			nsaId: assignedSystemBot.nsaId,
			name: assignedSystemBot.coralAuthData.nsoAccount.user.name,
			imageUri: assignedSystemBot.coralAuthData.nsoAccount.user.imageUri,
			webServices: {
				splatnet3: assignedSystemBot.splatnet3Enabled ?? false
			}
		};
	}

	const accountCreatedAt = locals.nintendoAccount.createdAt;

	const notices = await Promise.all(
		(
			await db
				.select({
					id: notice.id,
					title: notice.title,
					content: notice.content,
					requireAcknowledgement: notice.requireAcknowledgement,
					category: notice.category,
					createdAt: sql<number | string>`${notice.createdAt}`,
					acknowledged: sql<boolean>`(
						${notice.requireAcknowledgement} = 1
						AND ${acknowledgedNotice.noticeId} IS NOT NULL
					)`.mapWith(Boolean)
				})
				.from(notice)
				.leftJoin(
					acknowledgedNotice,
					and(
						eq(acknowledgedNotice.noticeId, notice.id),
						eq(acknowledgedNotice.nintendoAccountId, locals.nintendoAccount.id)
					)
				)
		).map(async ({ createdAt, ...noticeRow }): Promise<CoralSvelteNotice> => {
			const noticeCreatedAt = parseStoredTimestamp(createdAt);

			return {
				...noticeRow,
				createdAt: noticeCreatedAt,
				acknowledged: noticeRow.acknowledged || noticeCreatedAt < accountCreatedAt,
				contentHtml: await renderMarkdown(noticeRow.content)
			};
		})
	);

	const admin = isAdmin(locals.nintendoAccount.naId);

	const siteSettings = await db.select().from(siteSetting).where(eq(siteSetting.id, 1)).get();

	const adminSettings = admin
		? (siteSettings ?? {
				signUpEnabled: false,
				discordEnrolmentEnabled: false,
				discordEnrolmentLimit: 100,
				discordInviteLink: 'https://discord.gg/bmCyVeF6Vw'
			})
		: null;

	const deferredData = !isDataRequest
		? { friends, media, webServices, userInfo, notifications }
		: await Promise.all([friends, media, webServices, userInfo, notifications]).then(
				([friends, media, webServices, userInfo, notifications]) => ({
					friends,
					media,
					webServices,
					userInfo,
					notifications
				}),
				() => ({ friends, media, webServices, userInfo, notifications })
			);

	const [{ count: totalLinks }] = await db.select({ count: count() }).from(discordLinks);

	const discordEnrolmentEnabled =
		!!siteSettings?.discordEnrolmentEnabled && siteSettings.discordEnrolmentLimit > totalLinks;

	const discordErrorCode = url.searchParams.get('discordError');
	const discordLinkError = discordErrorCode
		? (DISCORD_LINK_ERROR_MESSAGES[discordErrorCode] ?? DISCORD_LINK_ERROR_MESSAGES.unassigned)
		: null;

	return {
		...deferredData,
		signupBlocked: locals.nintendoAccount.botFriendshipBlocked ?? false,
		signupBlockedReason: locals.nintendoAccount.botFriendshipBlockedReason ?? null,
		passkeys: registeredPasskeys,
		discordLink: linkedDiscordAccount,
		presenceSession,
		dataAccessLogs,
		visibleSystemBotInfo,
		notices,
		allowAssets: locals.nintendoAccount.accessNintendoAssets,
		isAdmin: admin,
		adminSettings,
		userPermissions: locals.nintendoAccount.currentUserPermissions,
		discordEnrolmentEnabled,
		discordLinkError
	};
}) satisfies LayoutServerLoad;
