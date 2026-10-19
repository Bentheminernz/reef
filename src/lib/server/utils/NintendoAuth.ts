import { and, count, eq, isNull, ne } from 'drizzle-orm';
import CoralApi, { CoralErrorResponse, CoralStatus, type Friends_4 } from 'nxapi/coral';
import { db } from '$lib/server/db';
import { nintendoAccount, systemBotUser, friendCodeData, siteSetting } from '$lib/server/db/schema';
import type { SignupBlockedReason } from '$lib/types/signup';
import {
	getCoralApi,
	getCoralFriends,
	getSystemBotCoralApi,
	invalidateCoralFriends
} from '$lib/server/coral';
import { acceptPrivacyPolicy, getCurrentPrivacyPolicy } from '$lib/server/policy';
import type { NintendoAccountSessionToken } from 'nxapi/nintendo-account';

const FRIEND_LIMIT = 300;
export const MAX_ACCOUNTS_PER_SYSTEM_BOT = FRIEND_LIMIT;

const RECEIVER_FRIEND_LIMIT_EXCEEDED = 9462;
const NSA_NOT_LINKED = CoralStatus.NSA_NOT_LINKED;

const PERMISSIONS_CACHE_TTL_MS = 5 * 60 * 1000;

export type BotFriendshipStatus = 'complete' | 'friend-limit' | 'requests-disabled' | 'unassigned';

export interface SystemBotCapacity {
	friendCount: number | null;
	assignedAccounts: number;
}

export function systemBotHasRoom(bot: SystemBotCapacity): boolean {
	const used = bot.friendCount ?? bot.assignedAccounts;

	return used < MAX_ACCOUNTS_PER_SYSTEM_BOT;
}

export class SignUpDisabledError extends Error {
	constructor() {
		super('Sign ups are disabled');
		this.name = 'SignUpDisabledError';
	}
}

export class SignUpLimitReached extends Error {
	constructor() {
		super('Maximum amount of users has been reached');
		this.name = 'SignUpLimitReached';
	}
}

export class NintendoSwitchNotLinkedError extends Error {
	constructor() {
		super("This account isn't linked to a Nintendo Switch console.");
		this.name = 'NintendoSwitchNotLinkedError';
	}
}

function isNsaNotLinkedError(error: unknown): boolean {
	return error instanceof CoralErrorResponse && error.status === NSA_NOT_LINKED;
}

function getSubFromSessionToken(sessionToken: string): string {
	const payload = sessionToken.split('.')[1];
	const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
	return decoded.sub;
}

type NintendoAccount = typeof nintendoAccount.$inferSelect;

async function ensureBotFriendship(account: NintendoAccount): Promise<BotFriendshipStatus> {
	const botNsaIds = new Set(
		(await db.select({ nsaId: systemBotUser.nsaId }).from(systemBotUser).all()).map(
			(bot) => bot.nsaId
		)
	);

	if (account.systemBotUserId != null) {
		let stillFriends: boolean;
		let assignedBotNsaId: string | null = null;

		try {
			const userCoral = await getCoralApi(account);
			const assignedBot = await db
				.select({ nsaId: systemBotUser.nsaId })
				.from(systemBotUser)
				.where(eq(systemBotUser.id, account.systemBotUserId))
				.get();

			if (assignedBot == null) {
				console.warn(
					`Assigned system bot ${account.systemBotUserId} no longer exists; reassigning`
				);
				stillFriends = false;
			} else {
				assignedBotNsaId = assignedBot.nsaId;
				stillFriends = await userHasFriend(userCoral, account, assignedBot.nsaId);

				if (!stillFriends) {
					console.warn(
						`Account ${account.id} is no longer friends with system bot ${assignedBot.nsaId}; re-adding`
					);
				}
			}
		} catch (error) {
			console.error('Failed to verify system bot friendship', error);
			stillFriends = true;
		}

		if (stillFriends) {
			if (account.botFriendshipBlocked) {
				await setBotFriendshipBlocked(account, false);
			}

			if (assignedBotNsaId != null) {
				try {
					const userCoral = await getCoralApi(account);
					await removeStaleBotFriendships(userCoral, account, botNsaIds, assignedBotNsaId);
				} catch (error) {
					console.error('Failed to clean up stale system bot friendships', error);
				}
			}

			return 'complete';
		}

		if (assignedBotNsaId != null) {
			try {
				const userCoral = await getCoralApi(account);
				await userCoral.deleteFriend(assignedBotNsaId);
				invalidateCoralFriends(account.id);
			} catch (error) {
				console.warn(`Could not unfriend previous system bot ${assignedBotNsaId}`, error);
			}
		}

		await db
			.update(nintendoAccount)
			.set({ systemBotUserId: null, botFriendshipBlocked: false, botFriendshipBlockedReason: null })
			.where(eq(nintendoAccount.id, account.id));

		account.systemBotUserId = null;
		account.botFriendshipBlocked = false;
	}

	const candidates = await db
		.select({
			id: systemBotUser.id,
			naId: systemBotUser.naId,
			nsaId: systemBotUser.nsaId,
			friendCount: systemBotUser.friendCount,
			assignedAccounts: count(nintendoAccount.id)
		})
		.from(systemBotUser)
		.leftJoin(nintendoAccount, eq(nintendoAccount.systemBotUserId, systemBotUser.id))
		.where(ne(systemBotUser.naId, account.naId))
		.groupBy(systemBotUser.id)
		.all();

	const availableBots = candidates.filter(systemBotHasRoom).sort((a, b) => {
		const aUsed = a.friendCount ?? a.assignedAccounts;
		const bUsed = b.friendCount ?? b.assignedAccounts;

		return aUsed - bUsed;
	});

	if (availableBots.length === 0) {
		console.warn(
			`No system bot user with fewer than ${MAX_ACCOUNTS_PER_SYSTEM_BOT} friends available`
		);
		return 'unassigned';
	}

	const userCoral = await getCoralApi(account);
	const lookupCoral = await getSystemBotCoralApi(availableBots[0].id);
	const friendCode = await userCoral.getFriendCodeUrl();
	const userLookUp = await lookupCoral.getUserByFriendCode(friendCode.friendCode);

	await persistFriendCode(account.id, friendCode);

	if (account.nsaId != null && userLookUp.nsaId !== account.nsaId) {
		console.error('User lookup and user nsaId do not match');
		return 'unassigned';
	}

	if (account.nsaId == null) {
		account.nsaId = userLookUp.nsaId;

		await db
			.update(nintendoAccount)
			.set({ nsaId: userLookUp.nsaId })
			.where(eq(nintendoAccount.id, account.id));
	}

	let userFriendList: Friends_4;

	try {
		userFriendList = await getCoralFriends(account, userCoral);
	} catch (error) {
		console.error('Failed to read the user friend list', error);
		return 'unassigned';
	}

	if (userFriendList.friends.length >= FRIEND_LIMIT) {
		await setBotFriendshipBlocked(account, true, 'friend-limit');
		return 'friend-limit';
	}

	let sawFullBot = false;

	for (const systemBot of availableBots) {
		try {
			let accepted = await acceptBotRequestIfPresent(userCoral, systemBot.nsaId);

			if (!accepted) {
				const receptionDisabled = await friendRequestReceptionDisabled(account, userCoral);

				if (receptionDisabled) {
					console.error(
						'User %s is trying to friend bot %d but has requests disabled',
						account.id,
						systemBot.id
					);
					await setBotFriendshipBlocked(account, true, 'requests-disabled');
					return 'requests-disabled';
				}

				const botCoral = await getSystemBotCoralApi(systemBot.id);
				await botCoral.sendFriendRequest(userLookUp.nsaId);
				accepted = await acceptBotRequestIfPresent(userCoral, systemBot.nsaId);

				if (!accepted) {
					console.error(`Friend request from system bot ${systemBot.naId} not found after sending`);
					continue;
				}
			}

			const claimed = await db
				.update(nintendoAccount)
				.set({
					systemBotUserId: systemBot.id,
					botFriendshipBlocked: false,
					botFriendshipBlockedReason: null
				})
				.where(and(eq(nintendoAccount.id, account.id), isNull(nintendoAccount.systemBotUserId)))
				.returning({ id: nintendoAccount.id });

			if (claimed.length === 0) {
				const current = await db
					.select({ systemBotUserId: nintendoAccount.systemBotUserId })
					.from(nintendoAccount)
					.where(eq(nintendoAccount.id, account.id))
					.get();

				if (current?.systemBotUserId !== systemBot.id) {
					try {
						await userCoral.deleteFriend(systemBot.nsaId);
						invalidateCoralFriends(account.id);
					} catch (error) {
						console.error('Failed to undo duplicate system bot friendship', error);
					}

					continue;
				}
			}

			account.systemBotUserId = systemBot.id;
			account.botFriendshipBlocked = false;

			await removeStaleBotFriendships(userCoral, account, botNsaIds, systemBot.nsaId);

			invalidateCoralFriends(account.id);

			return 'complete';
		} catch (error) {
			if (error instanceof CoralErrorResponse && error.status === RECEIVER_FRIEND_LIMIT_EXCEEDED) {
				sawFullBot = true;
				console.warn(`System bot ${systemBot.naId} is full, trying another`);
				continue;
			}

			console.error('System bot friend request flow failed', error);
			continue;
		}
	}

	if (sawFullBot) {
		await setBotFriendshipBlocked(account, true, 'friend-limit');
		return 'friend-limit';
	}

	return 'unassigned';
}

async function friendRequestReceptionDisabled(
	account: NintendoAccount,
	userCoral: CoralApi
): Promise<boolean> {
	try {
		const permissions = await userCoral.getCurrentUserPermissions();

		await db
			.update(nintendoAccount)
			.set({ currentUserPermissions: permissions, permissionsSyncedAt: new Date() })
			.where(eq(nintendoAccount.id, account.id));

		account.currentUserPermissions = permissions;
		account.permissionsSyncedAt = new Date();

		return permissions.permissions.friendRequestReception === false;
	} catch (error) {
		console.error('Failed to read user permissions', error);

		return account.currentUserPermissions?.permissions.friendRequestReception === false;
	}
}

async function userHasFriend(
	userCoral: CoralApi,
	account: NintendoAccount,
	nsaId: string
): Promise<boolean> {
	const cached = await getCoralFriends(account, userCoral);

	if (cached.friends.some((friend) => friend.nsaId === nsaId)) return true;

	invalidateCoralFriends(account.id);

	const fresh = await getCoralFriends(account, userCoral);

	return fresh.friends.some((friend) => friend.nsaId === nsaId);
}

async function removeStaleBotFriendships(
	userCoral: CoralApi,
	account: NintendoAccount,
	botNsaIds: Set<string>,
	keepNsaId: string
): Promise<void> {
	try {
		const friendList = await getCoralFriends(account, userCoral);
		const staleBots = friendList.friends.filter(
			(friend) => friend.nsaId !== keepNsaId && botNsaIds.has(friend.nsaId)
		);

		if (staleBots.length === 0) return;

		for (const friend of staleBots) {
			try {
				await userCoral.deleteFriend(friend.nsaId);
				console.warn(
					`Removed stale system bot friendship ${friend.nsaId} from account ${account.id}`
				);
			} catch (error) {
				console.error(`Failed to remove stale system bot friendship ${friend.nsaId}`, error);
			}
		}

		invalidateCoralFriends(account.id);
	} catch (error) {
		console.error('Failed to clean up stale system bot friendships', error);
	}
}

async function acceptBotRequestIfPresent(userCoral: CoralApi, botNsaId: string): Promise<boolean> {
	const receivedRequests = await userCoral.getReceivedFriendRequests();
	const botRequest = receivedRequests.friendRequests.find(
		(request) => request.sender.nsaId === botNsaId
	);

	if (!botRequest) return false;

	await userCoral.acceptFriendRequest(botRequest.id);
	return true;
}

async function setBotFriendshipBlocked(
	account: NintendoAccount,
	blocked: boolean,
	reason: SignupBlockedReason | null = null
) {
	await db
		.update(nintendoAccount)
		.set({ botFriendshipBlocked: blocked, botFriendshipBlockedReason: blocked ? reason : null })
		.where(eq(nintendoAccount.id, account.id));

	account.botFriendshipBlocked = blocked;
	account.botFriendshipBlockedReason = blocked ? reason : null;
}

async function persistFriendCode(
	accountId: string,
	friendCode: { friendCode: string; url: string }
) {
	await db
		.insert(friendCodeData)
		.values({
			nintendoAccountId: accountId,
			friendCode: friendCode.friendCode,
			friendCodeURL: friendCode.url
		})
		.onConflictDoUpdate({
			target: friendCodeData.nintendoAccountId,
			set: {
				friendCode: friendCode.friendCode,
				friendCodeURL: friendCode.url,
				generatedAt: new Date()
			}
		});
}

export async function ensureFriendCode(nintendoAccountId: string) {
	try {
		const account = await db
			.select()
			.from(nintendoAccount)
			.where(eq(nintendoAccount.id, nintendoAccountId))
			.get();

		if (account == null) return;

		const existing = await db
			.select({ nintendoAccountId: friendCodeData.nintendoAccountId })
			.from(friendCodeData)
			.where(eq(friendCodeData.nintendoAccountId, account.id))
			.get();

		if (existing != null) return;

		const userCoral = await getCoralApi(account);
		const friendCode = await userCoral.getFriendCodeUrl();

		await persistFriendCode(account.id, friendCode);
	} catch (error) {
		console.error('Failed to cache friend code during login', error);
	}
}

export async function ensureUserPermissions(nintendoAccountId: string) {
	try {
		const account = await db
			.select()
			.from(nintendoAccount)
			.where(eq(nintendoAccount.id, nintendoAccountId))
			.get();

		if (account == null) return;

		if (
			account.currentUserPermissions != null &&
			account.permissionsSyncedAt != null &&
			Date.now() - account.permissionsSyncedAt.getTime() < PERMISSIONS_CACHE_TTL_MS
		) {
			return;
		}

		const userCoral = await getCoralApi(account);
		const userPermissions = await userCoral.getCurrentUserPermissions();

		await db
			.update(nintendoAccount)
			.set({ currentUserPermissions: userPermissions, permissionsSyncedAt: new Date() })
			.where(eq(nintendoAccount.id, account.id));
	} catch (error) {
		console.error('Failed to cache user permissions during login', error);
	}
}

export async function retryBotFriendship(nintendoAccountId: string): Promise<BotFriendshipStatus> {
	const account = await db
		.select()
		.from(nintendoAccount)
		.where(eq(nintendoAccount.id, nintendoAccountId))
		.get();

	if (account == null) {
		throw new Error('Nintendo account not found');
	}

	const status = await ensureBotFriendship(account);

	if (status === 'complete') {
		invalidateCoralFriends(account.id);
	}

	return status;
}

export async function loginWithSessionToken(sessionToken: string, code: string) {
	const naId = getSubFromSessionToken(sessionToken);

	const nintendoAccountSession: NintendoAccountSessionToken = {
		session_token: sessionToken,
		code
	};

	const siteSettings = await db.select().from(siteSetting).where(eq(siteSetting.id, 1)).get();

	const existingAccount = await db
		.select()
		.from(nintendoAccount)
		.where(eq(nintendoAccount.naId, naId))
		.get();

	let account = existingAccount;
	let createdAccount = false;

	if (account) {
		await db
			.update(nintendoAccount)
			.set({ nintendoAccountSession })
			.where(eq(nintendoAccount.id, account.id));

		account.nintendoAccountSession = nintendoAccountSession;
	} else {
		if (!siteSettings?.signUpEnabled) {
			throw new SignUpDisabledError();
		}

		const [{ total }] = await db.select({ total: count() }).from(nintendoAccount);

		if (total >= siteSettings.signUpLimit) {
			throw new SignUpLimitReached();
		}

		[account] = await db
			.insert(nintendoAccount)
			.values({
				naId,
				nintendoAccountSession
			})
			.returning();

		createdAccount = true;
	}

	try {
		await getCoralApi(account);
	} catch (error) {
		if (!isNsaNotLinkedError(error)) throw error;

		if (createdAccount) {
			await db.delete(nintendoAccount).where(eq(nintendoAccount.id, account.id));
		}

		throw new NintendoSwitchNotLinkedError();
	}

	if (createdAccount) {
		const policy = await getCurrentPrivacyPolicy();
		if (policy != null) await acceptPrivacyPolicy(account.id, policy.id);
	}

	await ensureFriendCode(account.id);
	await ensureUserPermissions(account.id);

	const botFriendship = await ensureBotFriendship(account);

	return { account, botFriendship };
}
