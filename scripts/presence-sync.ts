import '$lib/server/nxapi';
import { setDefaultResultOrder } from 'node:dns';
import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	discordLinks,
	friendCodeData,
	nintendoAccount,
	presenceSessions,
	systemBotUser
} from '$lib/server/db/schema';
import { getSystemBotCoralApi, getSystemBotSplatnetApi } from '$lib/server/coral';
import { pruneDataAccess } from '$lib/server/dataAccess';
import {
	applyActivityStart,
	buildDiscordActivity,
	getGameKey,
	mergePresenceSnapshot
} from '$lib/server/utils/DiscordActivity';
import { applyActivityCallbacks, type PresenceMonitor } from '$lib/server/utils/presence/monitor';
import { SplatNet3Monitor } from '$lib/server/utils/presence/splatnet3';
import {
	createDiscordHeadlessSession,
	endDiscordHeadlessSession,
	updateDiscordHeadlessSession
} from '$lib/server/utils/DiscordAuth';

setDefaultResultOrder('ipv4first');
setDefaultAutoSelectFamilyAttemptTimeout(1000);

const INTERVAL_MS = 30_000;
const INTERVAL_JITTER_MS = 10_000;
const SESSION_EXPIRY_MS = 15 * 60 * 1000;

const SYNC_CONCURRENCY = Math.max(1, Number(process.env.PRESENCE_SYNC_CONCURRENCY ?? 8) || 8);
const BOT_CONCURRENCY = Math.max(1, Number(process.env.PRESENCE_BOT_CONCURRENCY ?? 4) || 4);

type SystemBot = typeof systemBotUser.$inferSelect;

interface RunSummary {
	bots: number;
	// session new
	published: number;
	// session refreshed
	refreshed: number;
	// session ended due to invalid token
	unpublished: number;
	// user is offline
	offline: number;
	// session skipped because friend was not found
	skipped: number;
	// session where already published and unchanged
	unchanged: number;
	// session skipped for discord auth
	reauth: number;
	// failed presence check
	failed: number;
}

async function forEachWithConcurrency<T>(
	items: T[],
	concurrency: number,
	task: (item: T) => Promise<void>
): Promise<void> {
	let next = 0;

	const worker = async () => {
		while (next < items.length) {
			await task(items[next++]);
		}
	};

	await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
}

async function syncBot(bot: SystemBot, applicationId: string, summary: RunSummary) {
	// if the script starts getting splatnet ready while fetching friends it reduces overall time
	const monitorPromise: Promise<SplatNet3Monitor | null> = bot.splatnet3Enabled
		? getSystemBotSplatnetApi(bot.id)
				.then(async (api) => {
					const monitor = new SplatNet3Monitor(api);
					await monitor.update().catch((error) => {
						console.error(`[presence-sync] Monitor ${monitor.id} update failed:`, error);
					});
					return monitor;
				})
				.catch((error) => {
					console.error(
						`[presence-sync] Failed to set up SplatNet 3 monitor for bot ${bot.id}:`,
						error
					);
					return null;
				})
		: Promise.resolve(null);

	const coral = await getSystemBotCoralApi(bot.id);
	const [friendList, monitor] = await Promise.all([coral.getFriendList(), monitorPromise]);
	const friends = new Map(friendList.friends.map((friend) => [friend.nsaId, friend]));

	await db
		.update(systemBotUser)
		.set({ friendCount: friendList.friends.length })
		.where(eq(systemBotUser.id, bot.id));

	const monitors: PresenceMonitor[] = monitor ? [monitor] : [];

	const sessions = await db
		.select({
			session: presenceSessions,
			discordLinkId: discordLinks.id,
			nsaId: nintendoAccount.nsaId,
			accountId: nintendoAccount.id
		})
		.from(presenceSessions)
		.innerJoin(discordLinks, eq(presenceSessions.discordLinkId, discordLinks.id))
		.innerJoin(nintendoAccount, eq(discordLinks.nintendoAccountId, nintendoAccount.id))
		.where(and(eq(presenceSessions.enabled, true), eq(nintendoAccount.systemBotUserId, bot.id)));

	const friendCodes = new Map<string, typeof friendCodeData.$inferSelect>();

	if (sessions.length > 0) {
		const rows = await db
			.select()
			.from(friendCodeData)
			.where(
				inArray(
					friendCodeData.nintendoAccountId,
					sessions.map(({ accountId }) => accountId)
				)
			);

		for (const row of rows) {
			friendCodes.set(row.nintendoAccountId, row);
		}
	}

	await forEachWithConcurrency(
		sessions,
		SYNC_CONCURRENCY,
		async ({ session, discordLinkId, nsaId, accountId }) => {
			const friend = nsaId == null ? undefined : friends.get(nsaId);
			const friendCode = friendCodes.get(accountId) ?? null;

			if (friend == null) {
				summary.skipped += 1;
				return;
			}

			try {
				const presence = mergePresenceSnapshot(session.presence, friend);

				let activity = buildDiscordActivity(
					friend,
					applicationId,
					session.platform,
					friendCode?.friendCodeURL,
					{
						showWhenInactive: session.showWhenInactive,
						showEShopButton: session.showEShopButton,
						showFriendCodeButton: session.showFriendCodeButton
					}
				);

				let discordToken = session.discordToken;
				if (!session.needsReauth && discordToken != null && session.publishFailures >= 3) {
					await endDiscordHeadlessSession(discordLinkId);
					discordToken = null;
				}

				const previousGameKey = discordToken != null ? getGameKey(session.presence?.game) : null;
				const activityStartedAt = activity
					? applyActivityStart(
							activity,
							previousGameKey,
							getGameKey(presence.game),
							session.startedAt
						)
					: session.startedAt;

				await db
					.update(presenceSessions)
					.set({ presence, startedAt: activityStartedAt, lastSyncedAt: new Date() })
					.where(eq(presenceSessions.id, session.id));

				if (activity != null && monitors.length > 0) {
					activity = await applyActivityCallbacks(monitors, activity, {
						coralFriend: friend,
						enabledWebServices: {
							splatnet3: session.splatnetEnabled
						}
					});
				}

				if (session.needsReauth) {
					summary.reauth += 1;
					return;
				}

				if (activity == null) {
					if (discordToken != null) {
						await endDiscordHeadlessSession(discordLinkId);
						summary.unpublished += 1;
					} else {
						summary.offline += 1;
					}

					return;
				}

				if (discordToken == null) {
					await createDiscordHeadlessSession(discordLinkId, activity);
					summary.published += 1;
					return;
				}

				const expired =
					session.publishedAt != null &&
					Date.now() - session.publishedAt.getTime() >= SESSION_EXPIRY_MS;

				if (expired) {
					await endDiscordHeadlessSession(discordLinkId);
					await createDiscordHeadlessSession(discordLinkId, activity);
					summary.refreshed += 1;
					return;
				}

				if (
					session.activity != null &&
					JSON.stringify(session.activity) === JSON.stringify(activity)
				) {
					summary.unchanged += 1;
					return;
				}

				await updateDiscordHeadlessSession(discordLinkId, activity);
				summary.published += 1;
			} catch (error) {
				summary.failed += 1;
				console.error(`[presence-sync] Failed to sync session ${session.id}:`, error);
			}
		}
	);
}

const applicationId = process.env.DISCORD_CLIENT_ID;

if (applicationId == null) {
	throw new Error('DISCORD_CLIENT_ID is not set');
}

const once = process.argv[2] === 'once';
const shutdown = new AbortController();

process.on('SIGINT', () => shutdown.abort());
process.on('SIGTERM', () => shutdown.abort());

const heartbeatUrl =
	process.env.NODE_ENV === 'production' ? process.env.HEALTHCHECK_PRESENCE_URL : undefined;

if (process.env.NODE_ENV === 'production') {
	console.log(
		heartbeatUrl
			? '[presence-sync] Healthcheck pings enabled'
			: '[presence-sync] Healthcheck pings disabled (HEALTHCHECK_PRESENCE_URL not set)'
	);
}

function pingHealthcheck(path = ''): void {
	if (!heartbeatUrl || once) return;

	void fetch(`${heartbeatUrl}${path}`, { signal: AbortSignal.timeout(10_000) }).catch((error) => {
		console.error('[presence-sync] Healthcheck ping failed:', error);
	});
}

let runIndex = 0;

while (true) {
	const run = runIndex++;
	const startedAt = Date.now();
	const summary: RunSummary = {
		bots: 0,
		published: 0,
		refreshed: 0,
		unpublished: 0,
		offline: 0,
		skipped: 0,
		unchanged: 0,
		reauth: 0,
		failed: 0
	};

	try {
		const bots = await db.select().from(systemBotUser);
		summary.bots = bots.length;

		await forEachWithConcurrency(bots, BOT_CONCURRENCY, async (bot) => {
			const botStartedAt = Date.now();

			try {
				await syncBot(bot, applicationId, summary);
				console.log(
					`[presence-sync] #${run} bot ${bot.naId} finished in ${Date.now() - botStartedAt}ms`
				);
			} catch (error) {
				summary.failed += 1;
				console.error(`[presence-sync] #${run} bot ${bot.naId} failed:`, error);
			}
		});

		console.log(`[presence-sync] #${run} finished in ${Date.now() - startedAt}ms`, summary);
		pingHealthcheck();
	} catch (error) {
		console.error(`[presence-sync] #${run} run failed:`, error);
		pingHealthcheck('/fail');
	}

	if (run % 60 === 0) {
		await pruneDataAccess().catch((error) =>
			console.error('[presence-sync] Data access prune failed:', error)
		);
	}

	if (once) break;

	const elapsed = Date.now() - startedAt;
	const jitter = Math.round((Math.random() * 2 - 1) * INTERVAL_JITTER_MS);
	const delay = Math.max(0, INTERVAL_MS - elapsed + jitter);

	try {
		await sleep(delay, undefined, { signal: shutdown.signal });
	} catch {
		break;
	}
}
