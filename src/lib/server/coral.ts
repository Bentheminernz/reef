import { decodeJwt } from 'jose';
import { and, eq } from 'drizzle-orm';
import CoralApi, {
	type Announcements_4,
	type CoralAuthData,
	type Friends_4,
	type NintendoAccountUserCoral
} from 'nxapi/coral';
import { ErrorResponse } from 'nxapi';
import { db } from '$lib/server/db';
import {
	friendCodeData,
	gameWebServiceTokens,
	nintendoAccount,
	systemBotUser
} from '$lib/server/db/schema';
import { logDataAccess } from '$lib/server/dataAccess';
import type { GameService } from '$lib/types/game-services';
import SplatNet3Api, { type SplatNet3AuthData, SplatNet3ErrorResponse } from 'nxapi/splatnet3';
import cached from '$lib/utils/cached';

type NintendoAccount = typeof nintendoAccount.$inferSelect;
type SplatnetBotAccount = typeof systemBotUser.$inferSelect;

interface CoralAccount {
	id: string;
	nintendoAccountSession: { session_token: string } | null;
	coralAuthData: CoralAuthData | null;
}

interface CoralClientOptions {
	logAccountId?: string;
}

interface CachedCoralClient {
	api: CoralApi;
	sessionToken: string;
}

const clients = new Map<string, CachedCoralClient>();
const creatingClients = new Map<string, Promise<CoralApi>>();
const renewingClients = new Map<string, Promise<CoralApi>>();
const mediaCache = new Map<
	string,
	{
		expiresAt: number;
		value: ReturnType<CoralApi['getMedia']>;
	}
>();
const userCache = new Map<
	string,
	{
		expiresAt: number;
		value: ReturnType<CoralApi['getCurrentUser']>;
	}
>();
const webServicesCache = new Map<
	string,
	{
		expiresAt: number;
		value: Promise<GameService[]>;
	}
>();
const friendsCache = new Map<
	string,
	{
		expiresAt: number;
		value: Promise<Friends_4>;
	}
>();
const notificationsCache = new Map<
	string,
	{
		expiresAt: number;
		value: Promise<Announcements_4>;
	}
>();
const webServiceTokenFlights = new Map<string, Promise<{ token: string; expiresAt: number }>>();

interface CachedSplatnetClient {
	api: SplatNet3Api;
	expiresAt: number;
}

const splatnetClients = new Map<string, CachedSplatnetClient>();
const creatingSplatnetClients = new Map<string, Promise<SplatNet3Api>>();

const MEDIA_CACHE_TTL = 5 * 60 * 1000;
const WEB_SERVICES_CACHE_TTL = 30 * 60 * 1000;
const FRIENDS_CACHE_TTL = 5 * 60 * 1000;
const NOTIFICATIONS_CACHE_TTL = 6 * 60 * 60 * 1000;
const TOKEN_EXPIRY_MARGIN = 60 * 1000;
const USER_CACHED = 5 * 60 * 1000;

export function getCoralApi(account: NintendoAccount): Promise<CoralApi> {
	return getCoralClient(
		account.id,
		account,
		(authData) =>
			db
				.update(nintendoAccount)
				.set({ coralAuthData: authData })
				.where(eq(nintendoAccount.id, account.id)),
		{ logAccountId: account.id }
	);
}

export async function getSystemBotCoralApi(systemBotUserId?: string): Promise<CoralApi> {
	const systemBot = await (systemBotUserId
		? db.select().from(systemBotUser).where(eq(systemBotUser.id, systemBotUserId)).get()
		: db.select().from(systemBotUser).get());

	if (systemBot == null) {
		throw new Error('System bot user is not configured');
	}

	return getCoralClient(`system-bot:${systemBot.id}`, systemBot, (authData) =>
		db
			.update(systemBotUser)
			.set({ coralAuthData: authData })
			.where(eq(systemBotUser.id, systemBot.id))
	);
}

export async function getSystemBotSplatnetApi(systemBotUserId?: string): Promise<SplatNet3Api> {
	const systemBot = await (systemBotUserId
		? db.select().from(systemBotUser).where(eq(systemBotUser.id, systemBotUserId)).get()
		: db.select().from(systemBotUser).get());

	if (systemBot == null) {
		throw new Error('System bot user is not configured');
	}

	if (!systemBot.splatnet3Enabled) {
		throw new Error('System bot does not have access to SplatNet3');
	}

	return getSplatnetClient(`system-bot:${systemBot.id}`, systemBot);
}

function getSplatnetClient(cacheKey: string, bot: SplatnetBotAccount): Promise<SplatNet3Api> {
	const cached = splatnetClients.get(cacheKey);

	if (cached && cached.expiresAt > Date.now() + TOKEN_EXPIRY_MARGIN) {
		return Promise.resolve(cached.api);
	}

	const existingPromise = creatingSplatnetClients.get(cacheKey);

	if (existingPromise) {
		return existingPromise;
	}

	const promise = createSplatnetClient(cacheKey, bot).finally(() => {
		creatingSplatnetClients.delete(cacheKey);
	});

	creatingSplatnetClients.set(cacheKey, promise);

	return promise;
}

async function createSplatnetClient(
	cacheKey: string,
	bot: SplatnetBotAccount
): Promise<SplatNet3Api> {
	const persistAuthData = (authData: SplatNet3AuthData) =>
		db
			.update(systemBotUser)
			.set({ splatnet3AuthData: authData })
			.where(eq(systemBotUser.id, bot.id));

	const getCoral = () =>
		getCoralClient(cacheKey, bot, (coralAuthData) =>
			db.update(systemBotUser).set({ coralAuthData }).where(eq(systemBotUser.id, bot.id))
		);

	let splatnet: SplatNet3Api;

	const renew = async (): Promise<SplatNet3AuthData> => {
		const coral = await getCoral();
		const user = await getSplatnetUser(bot.id);

		try {
			const renewed = await splatnet.renewTokenWithCoral(coral, user);

			await persistAuthData(renewed);
			splatnetClients.set(cacheKey, { api: splatnet, expiresAt: renewed.expires_at });

			return renewed;
		} catch (cause) {
			if (!isSplatnetServerError(cause)) throw cause;

			const authenticated = await SplatNet3Api.createWithCoral(coral, user);

			splatnet = authenticated.splatnet;
			await persistAuthData(authenticated.data);
			splatnet.onTokenExpired = renew;
			splatnet.onTokenShouldRenew = renew;
			splatnetClients.set(cacheKey, { api: splatnet, expiresAt: authenticated.data.expires_at });

			return authenticated.data;
		}
	};

	if (bot.splatnet3AuthData) {
		splatnet = SplatNet3Api.createWithSavedToken(bot.splatnet3AuthData);
	} else {
		const [coral, user] = await Promise.all([getCoral(), getSplatnetUser(bot.id)]);
		const authenticated = await SplatNet3Api.createWithCoral(coral, user);

		splatnet = authenticated.splatnet;
		await persistAuthData(authenticated.data);
	}

	splatnet.onTokenExpired = renew;
	splatnet.onTokenShouldRenew = renew;

	const expiresAt = bot.splatnet3AuthData?.expires_at;

	if (expiresAt != null && expiresAt <= Date.now() + TOKEN_EXPIRY_MARGIN) {
		await renew();
	} else {
		splatnetClients.set(cacheKey, {
			api: splatnet,
			expiresAt: expiresAt ?? Date.now() - TOKEN_EXPIRY_MARGIN
		});
	}

	return splatnet;
}

async function getSplatnetUser(botId: string): Promise<NintendoAccountUserCoral> {
	const bot = await db.select().from(systemBotUser).where(eq(systemBotUser.id, botId)).get();
	const user = bot?.coralAuthData?.user;

	if (user == null) {
		throw new Error('System bot is missing Coral auth data, which is required to use SplatNet3');
	}

	return user;
}

function isSplatnetServerError(err: unknown): err is SplatNet3ErrorResponse {
	return err instanceof SplatNet3ErrorResponse;
}

function getCoralClient(
	cacheKey: string,
	account: CoralAccount,
	persistAuthData: (authData: CoralAuthData) => Promise<unknown>,
	options: CoralClientOptions = {}
): Promise<CoralApi> {
	const sessionToken = account.nintendoAccountSession?.session_token;

	if (!sessionToken) {
		throw new Error('Nintendo Account session is missing');
	}

	const cached = clients.get(cacheKey);

	if (cached?.sessionToken === sessionToken) {
		if (!tokenExpiresSoon(cached.api.token)) {
			return Promise.resolve(cached.api);
		}

		const existingPromise = renewingClients.get(cacheKey);
		if (existingPromise) return existingPromise;

		const promise = cached.api.onTokenExpired
			? cached.api.onTokenExpired().then(() => cached.api)
			: Promise.resolve(cached.api);

		renewingClients.set(cacheKey, promise);
		void promise.then(
			() => renewingClients.delete(cacheKey),
			() => renewingClients.delete(cacheKey)
		);

		return promise;
	}

	const existingPromise = creatingClients.get(cacheKey);

	if (existingPromise) {
		return existingPromise;
	}

	const promise = createCoralApi(cacheKey, account, persistAuthData, sessionToken, options).finally(
		() => {
			creatingClients.delete(cacheKey);
		}
	);

	creatingClients.set(cacheKey, promise);

	return promise;
}

export function getCoralMedia(
	account: NintendoAccount,
	coral: CoralApi
): ReturnType<CoralApi['getMedia']> {
	return cached(mediaCache, account.id, MEDIA_CACHE_TTL, () => coral.getMedia());
}

export function invalidateCoralMedia(accountId: string): void {
	mediaCache.delete(accountId);
}

export function invalidateCoralFriends(accountId: string): void {
	friendsCache.delete(accountId);
}

export function getCoralShowSelf(
	account: NintendoAccount,
	coral: CoralApi
): ReturnType<CoralApi['getCurrentUser']> {
	return cached(userCache, account.id, USER_CACHED, () => coral.getCurrentUser());
}

export interface CoralFriendCode {
	friendCode: string;
	friendCodeURL: string;
	linkId: string | null;
	generatedAt: Date;
}

const FRIEND_CODE_TTL = 7 * 24 * 60 * 60 * 1000;

export async function getCoralFriendCode(
	account: NintendoAccount,
	coral: CoralApi
): Promise<CoralFriendCode> {
	const stored = await db
		.select()
		.from(friendCodeData)
		.where(eq(friendCodeData.nintendoAccountId, account.id))
		.get();

	let linkId: string | null = null;
	try {
		const currentUser = await getCoralShowSelf(account, coral);
		linkId = currentUser.links.friendCode.id;
	} catch {
		// looking up link failed, fall back to stored code
	}

	if (stored) {
		const confirmed = linkId != null && stored.linkId === linkId;
		const regenerated = linkId != null && stored.linkId != null && stored.linkId !== linkId;
		const fresh = stored.generatedAt.getTime() > Date.now() - FRIEND_CODE_TTL;

		if (confirmed) {
			return { ...stored, linkId, generatedAt: stored.generatedAt };
		}

		if (!regenerated && fresh) {
			if (linkId != null && stored.linkId == null) {
				await db
					.update(friendCodeData)
					.set({ linkId })
					.where(eq(friendCodeData.nintendoAccountId, account.id));
			}
			return { ...stored, linkId: linkId ?? stored.linkId };
		}
	}

	const { friendCode, url } = await coral.getFriendCodeUrl();
	const row = {
		nintendoAccountId: account.id,
		friendCode,
		friendCodeURL: url,
		linkId,
		generatedAt: new Date()
	};

	await db.insert(friendCodeData).values(row).onConflictDoUpdate({
		target: friendCodeData.nintendoAccountId,
		set: row
	});

	return row;
}

export function getCoralWebServices(
	account: NintendoAccount,
	coral: CoralApi
): Promise<GameService[]> {
	return cached(webServicesCache, account.id, WEB_SERVICES_CACHE_TTL, () =>
		coral.getWebServices().then((services) =>
			services.map((service) => ({
				id: service.id,
				uri: service.uri,
				whiteList: [...service.whiteList],
				name: service.name,
				imageUri: service.imageUri
			}))
		)
	);
}

export function getCoralFriends(account: NintendoAccount, coral: CoralApi): Promise<Friends_4> {
	return cached(friendsCache, account.id, FRIENDS_CACHE_TTL, () => coral.getFriendList());
}

export function getCoralNotifications(
	account: NintendoAccount,
	coral: CoralApi
): Promise<Announcements_4> {
	return cached(notificationsCache, account.id, NOTIFICATIONS_CACHE_TTL, () =>
		coral.getAnnouncements()
	);
}

export function clearNotificationsCache(accountId: string): void {
	notificationsCache.delete(accountId);
}

export function clearAccountCaches(accountId: string): void {
	mediaCache.delete(accountId);
	userCache.delete(accountId);
	webServicesCache.delete(accountId);
	friendsCache.delete(accountId);
	notificationsCache.delete(accountId);
	clients.delete(accountId);
	creatingClients.delete(accountId);
	renewingClients.delete(accountId);

	for (const key of webServiceTokenFlights.keys()) {
		if (key.startsWith(`${accountId}:`)) {
			webServiceTokenFlights.delete(key);
		}
	}
}

export async function getGameWebServiceToken(
	account: NintendoAccount,
	serviceId: number,
	forceFresh = false
): Promise<{ token: string; expiresAt: number }> {
	const cacheKey = `${account.id}:${serviceId}`;

	if (!forceFresh) {
		const cached = await db
			.select({ token: gameWebServiceTokens.token, expiresAt: gameWebServiceTokens.expiresAt })
			.from(gameWebServiceTokens)
			.where(
				and(
					eq(gameWebServiceTokens.nintendoAccountId, account.id),
					eq(gameWebServiceTokens.serviceId, serviceId)
				)
			)
			.get();

		if (cached && cached.expiresAt.getTime() > Date.now() + TOKEN_EXPIRY_MARGIN) {
			return { token: cached.token, expiresAt: cached.expiresAt.getTime() };
		}
	}

	const existing = webServiceTokenFlights.get(cacheKey);
	if (existing) return existing;

	const value = getCoralApi(account)
		.then((coral) => coral.getWebServiceToken(serviceId))
		.then(async (result) => {
			if (!result.accessToken) throw new Error('Nintendo did not return a game web service token');

			const expiresIn = Number.isFinite(result.expiresIn) ? result.expiresIn : 7200;
			const token = {
				token: result.accessToken,
				expiresAt: Date.now() + Math.max(60, expiresIn) * 1000
			};

			await db
				.insert(gameWebServiceTokens)
				.values({
					nintendoAccountId: account.id,
					serviceId,
					token: token.token,
					expiresAt: new Date(token.expiresAt),
					updatedAt: new Date()
				})
				.onConflictDoUpdate({
					target: [gameWebServiceTokens.nintendoAccountId, gameWebServiceTokens.serviceId],
					set: {
						token: token.token,
						expiresAt: new Date(token.expiresAt),
						updatedAt: new Date()
					}
				});
			return token;
		})
		.catch((cause) => {
			if (cause instanceof Error && cause.message.startsWith('[znca-api]')) {
				clients.delete(account.id);
			}
			throw cause;
		})
		.finally(() => webServiceTokenFlights.delete(cacheKey));

	webServiceTokenFlights.set(cacheKey, value);
	return value;
}

async function createCoralApi(
	cacheKey: string,
	account: CoralAccount,
	persistAuthData: (authData: CoralAuthData) => Promise<unknown>,
	sessionToken: string,
	options: CoralClientOptions
): Promise<CoralApi> {
	let authData: CoralAuthData;
	let coral: CoralApi;

	const track = (client: CoralApi) => trackCoralAccess(client, options);

	if (account.coralAuthData) {
		authData = account.coralAuthData;
		coral = track(CoralApi.createWithSavedToken(authData));

		if (tokenExpiresSoon(authData.credential.accessToken)) {
			try {
				const renewed = await coral.renewToken(sessionToken, authData.user);
				authData = { ...authData, ...renewed };
			} catch (cause) {
				if (!isIncompatibleClientError(cause)) throw cause;

				const authenticated = await CoralApi.createWithSessionToken(sessionToken);

				coral = track(authenticated.nso);
				authData = authenticated.data;
			}

			await persistAuthData(authData);
		}
	} else {
		const authenticated = await CoralApi.createWithSessionToken(sessionToken);

		coral = track(authenticated.nso);
		authData = authenticated.data;

		await persistAuthData(authData);
	}

	coral.onTokenExpired = async () => {
		try {
			const renewed = await coral.renewToken(sessionToken, authData.user);
			authData = { ...authData, ...renewed };
		} catch (cause) {
			if (!isIncompatibleClientError(cause)) throw cause;

			const authenticated = await CoralApi.createWithSessionToken(sessionToken);

			coral = track(authenticated.nso);
			authData = authenticated.data;

			clients.set(cacheKey, {
				api: coral,
				sessionToken
			});
		}

		await persistAuthData(authData);

		return authData;
	};

	clients.set(cacheKey, {
		api: coral,
		sessionToken
	});

	return coral;
}

function trackCoralAccess(coral: CoralApi, { logAccountId }: CoralClientOptions): CoralApi {
	if (logAccountId == null) return coral;

	type CoralFetch = CoralApi['fetch'];
	const originalFetch = coral.fetch.bind(coral);

	coral.fetch = (async (...args: Parameters<CoralFetch>) => {
		const [url] = args;
		try {
			const result = await originalFetch(...args);
			void logDataAccess(logAccountId, url.toString(), true).catch(() => undefined);
			return result;
		} catch (error) {
			void logDataAccess(logAccountId, url.toString(), false).catch(() => undefined);
			throw error;
		}
	}) as CoralFetch;

	return coral;
}

function tokenExpiresSoon(token: string): boolean {
	try {
		const { exp } = decodeJwt(token);

		return !exp || exp * 1000 <= Date.now() + 30_000;
	} catch {
		return true;
	}
}

function isIncompatibleClientError(err: unknown): err is ErrorResponse {
	return (
		err instanceof ErrorResponse &&
		(err.data as { error?: string } | undefined)?.error === 'incompatible_client'
	);
}
