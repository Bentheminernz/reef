import type {
	DiscordActivity,
	DiscordHeadlessResponse,
	DiscordTokenInfo,
	DiscordTokenResponse,
	DiscordUserResponse
} from '$lib/types/discord-auth';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { discordLinks, presenceSessions } from '../db/schema';

export type DiscordErrorKind = 'auth' | 'session' | 'rate_limit' | 'transient' | 'unknown';

export class DiscordApiError extends Error {
	constructor(
		message: string,
		readonly kind: DiscordErrorKind,
		readonly status: number,
		readonly body: string
	) {
		super(message);
		this.name = 'DiscordApiError';
	}
}

export class DiscordEnrolmentLimit extends Error {
	constructor() {
		super('Maximum amount of users have enrolled with Discord.');
		this.name = 'DiscordEnrolmentLimitReached';
	}
}

export class DiscordEnrolmentDisabled extends Error {
    constructor() {
        super('Linking your Discord account to Reef is currently disabled')
        this.name = 'DiscordEnrolmentDisabled'
    }
}

interface DiscordErrorBody {
	code?: number;
	message?: string;
	error?: string;
	error_description?: string;
}

function parseDiscordError(body: string): DiscordErrorBody {
	try {
		const parsed = JSON.parse(body) as unknown;

		return typeof parsed === 'object' && parsed !== null ? (parsed as DiscordErrorBody) : {};
	} catch {
		return {};
	}
}

function classifyHeadlessError(
	status: number,
	body: string,
	operation: 'create' | 'update' | 'delete'
): DiscordErrorKind {
	const parsed = parseDiscordError(body);

	if (status === 429) return 'rate_limit';
	if (status >= 500) return 'transient';
	if (parsed.code === 10020) return 'session';
	if (parsed.code === 50014) return operation === 'create' ? 'auth' : 'session';
	if (parsed.code === 50025 || parsed.code === 40001) return 'auth';
	if (status === 401) return operation === 'delete' ? 'session' : 'auth';
	if (status === 403) return 'auth';

	return 'unknown';
}

function classifyOAuthError(status: number, body: string): DiscordErrorKind {
	if (status === 429) return 'rate_limit';
	if (status >= 500) return 'transient';

	const parsed = parseDiscordError(body);

	if (parsed.error === 'invalid_grant') return 'auth';

	return 'unknown';
}

async function recordPublishFailure(
	discordLinkId: string,
	message: string,
	options: { needsReauth?: boolean } = {}
) {
	await db
		.update(presenceSessions)
		.set({
			publishFailures: sql`${presenceSessions.publishFailures} + 1`,
			lastPublishError: message,
			...(options.needsReauth ? { needsReauth: true } : {})
		})
		.where(eq(presenceSessions.discordLinkId, discordLinkId));
}

async function recordPublishSuccess(discordLinkId: string) {
	await db
		.update(presenceSessions)
		.set({ publishFailures: 0, lastPublishError: null, needsReauth: false })
		.where(eq(presenceSessions.discordLinkId, discordLinkId));
}

export function getDiscordRedirectURI() {
	return process.env.DISCORD_REDIRECT_URI ?? 'http://localhost:5173/api/discord/callback';
}

export function generateDiscordAuthURL() {
	const discordClientId = process.env.DISCORD_CLIENT_ID;
	const state = randomUUID();

	if (discordClientId == null) {
		console.error('null discordClientId found.');
		throw new Error("Discord Client ID can't be null or undefined");
	}

	const authoriseURL = new URL('https://discord.com/oauth2/authorize');

	authoriseURL.searchParams.append('response_type', 'code');
	authoriseURL.searchParams.append('client_id', discordClientId);
	authoriseURL.searchParams.append('scope', 'openid identify sdk.social_layer_presence');
	authoriseURL.searchParams.append('state', state);
	authoriseURL.searchParams.append('redirect_uri', getDiscordRedirectURI());

	return {
		state,
		authoriseURL
	};
}

export async function exchangeCallbackCode(code: string): Promise<DiscordTokenResponse> {
	const clientId = process.env.DISCORD_CLIENT_ID;
	const clientSecret = process.env.DISCORD_CLIENT_SECRET;

	if (clientId == null || clientSecret == null) {
		console.error('clientId or clientSecret is null.');
		throw new Error('Token exchange failed.');
	}

	const body = new URLSearchParams();
	body.append('client_id', clientId);
	body.append('client_secret', clientSecret);
	body.append('grant_type', 'authorization_code');
	body.append('code', code);
	body.append('redirect_uri', getDiscordRedirectURI());

	const response = await fetch('https://discord.com/api/oauth2/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body
	});

	if (!response.ok) {
		const errorBody = await response.text();
		console.error('Discord token exchange failed %s', errorBody);
		throw new Error('Token exchange failed.');
	}

	const tokens = (await response.json()) as DiscordTokenResponse;

	return tokens;
}

export async function fetchDiscordUser(accessToken: string): Promise<DiscordUserResponse> {
	const response = await fetch('https://discord.com/api/users/@me', {
		headers: {
			Authorization: `Bearer ${accessToken}`
		}
	});

	if (!response.ok) {
		const errorBody = await response.text();

		console.error('Discord user fetch failed (%d): %s', response.status, errorBody);

		throw new Error('Failed to fetch Discord user.');
	}

	return (await response.json()) as DiscordUserResponse;
}

const refreshFlights = new Map<string, Promise<DiscordTokenInfo>>();

export async function refreshDiscordAccessToken(
	discordUserId: string,
	refreshToken: string,
	retryOnRotated = true
): Promise<DiscordTokenInfo> {
	const clientId = process.env.DISCORD_CLIENT_ID;
	const clientSecret = process.env.DISCORD_CLIENT_SECRET;

	if (clientId == null || clientSecret == null) {
		console.error('clientId or clientSecret is null.');
		throw new DiscordApiError(
			'Token refresh failed: missing Discord client credentials.',
			'auth',
			0,
			''
		);
	}

	const response = await fetch('https://discord.com/api/oauth2/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({
			client_id: clientId,
			client_secret: clientSecret,
			grant_type: 'refresh_token',
			refresh_token: refreshToken
		}).toString()
	});

	if (!response.ok) {
		const errorBody = await response.text();
		const kind = classifyOAuthError(response.status, errorBody);

		if (kind === 'auth' && retryOnRotated) {
			const current = await db
				.select()
				.from(discordLinks)
				.where(eq(discordLinks.discordUserId, discordUserId))
				.get();

			if (current != null && current.discordAuth.refresh_token !== refreshToken) {
				return refreshDiscordAccessToken(discordUserId, current.discordAuth.refresh_token, false);
			}
		}

		console.error('Token refresh failed (%d): %s', response.status, errorBody);
		throw new DiscordApiError('Token refresh failed.', kind, response.status, errorBody);
	}

	const tokens = (await response.json()) as DiscordTokenResponse;
	const expiresAt = Math.floor(Date.now() / 1000) + tokens.expires_in;

	const discordAuth: DiscordTokenInfo = {
		expires_time: expiresAt,
		...tokens
	};

	await db
		.update(discordLinks)
		.set({ discordAuth })
		.where(eq(discordLinks.discordUserId, discordUserId));

	return discordAuth;
}

export async function getDiscordAccessToken(discordUserId: string) {
	const discordUser = await db
		.select()
		.from(discordLinks)
		.where(eq(discordLinks.discordUserId, discordUserId))
		.get();

	if (discordUser == null) {
		throw new DiscordApiError('Discord account is not linked.', 'auth', 0, '');
	}

	const nowSeconds = Math.floor(Date.now() / 1000);
	if (discordUser.discordAuth.expires_time > nowSeconds + 60) {
		return discordUser.discordAuth.access_token;
	}

	let flight = refreshFlights.get(discordUserId);

	if (flight == null) {
		flight = refreshDiscordAccessToken(discordUserId, discordUser.discordAuth.refresh_token);
		refreshFlights.set(discordUserId, flight);

		void flight
			.finally(() => {
				if (refreshFlights.get(discordUserId) === flight) {
					refreshFlights.delete(discordUserId);
				}
			})
			.catch(() => {});
	}

	return (await flight).access_token;
}

async function getDiscordAccessTokenForLink(discordLinkId: string) {
	const link = await db
		.select({ discordUserId: discordLinks.discordUserId })
		.from(discordLinks)
		.where(eq(discordLinks.id, discordLinkId))
		.get();

	if (link == null) {
		throw new DiscordApiError('Discord account is not linked.', 'auth', 0, '');
	}

	try {
		return await getDiscordAccessToken(link.discordUserId);
	} catch (error) {
		if (error instanceof DiscordApiError && error.kind === 'auth') {
			await recordPublishFailure(discordLinkId, error.message, { needsReauth: true }).catch(
				() => {}
			);
		}

		throw error;
	}
}

export async function createDiscordHeadlessSession(
	discordLinkId: string,
	discordActivity: DiscordActivity
) {
	const discordAccessToken = await getDiscordAccessTokenForLink(discordLinkId);

	const response = await fetch('https://discord.com/api/v10/users/@me/headless-sessions', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${discordAccessToken}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			activities: [discordActivity]
		})
	});

	if (!response.ok) {
		const errorResponse = await response.text();
		const kind = classifyHeadlessError(response.status, errorResponse, 'create');
		const message = `Creating Discord headless session failed (${response.status}): ${errorResponse}`;

		console.error('[DiscordAuth]', message);
		await recordPublishFailure(discordLinkId, message, { needsReauth: kind === 'auth' }).catch(
			() => {}
		);

		throw new DiscordApiError(
			'Creating Discord headless session failed.',
			kind,
			response.status,
			errorResponse
		);
	}

	const session = (await response.json()) as DiscordHeadlessResponse;

	await db
		.update(presenceSessions)
		.set({
			discordToken: session.token,
			activity: discordActivity,
			publishedAt: new Date()
		})
		.where(eq(presenceSessions.discordLinkId, discordLinkId));

	await recordPublishSuccess(discordLinkId);
}

export async function updateDiscordHeadlessSession(
	discordLinkId: string,
	discordActivity: DiscordActivity
) {
	const presenceSession = await db
		.select()
		.from(presenceSessions)
		.where(eq(presenceSessions.discordLinkId, discordLinkId))
		.get();

	if (presenceSession?.discordToken == null) {
		throw new DiscordApiError('No active Discord headless session.', 'session', 0, '');
	}

	const discordAccessToken = await getDiscordAccessTokenForLink(discordLinkId);

	const response = await fetch('https://discord.com/api/v10/users/@me/headless-sessions', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${discordAccessToken}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			activities: [discordActivity],
			token: presenceSession.discordToken
		})
	});

	if (!response.ok) {
		const errorResponse = await response.text();
		const kind = classifyHeadlessError(response.status, errorResponse, 'update');
		const message = `Updating Discord headless session failed (${response.status}): ${errorResponse}`;

		console.error('[DiscordAuth]', message);

		if (kind === 'session') {
			await db
				.update(presenceSessions)
				.set({ discordToken: null, activity: null, publishedAt: null })
				.where(eq(presenceSessions.discordLinkId, discordLinkId));
		}

		await recordPublishFailure(discordLinkId, message, { needsReauth: kind === 'auth' }).catch(
			() => {}
		);

		throw new DiscordApiError(
			'Updating Discord headless session failed.',
			kind,
			response.status,
			errorResponse
		);
	}

	const session = (await response.json()) as DiscordHeadlessResponse;

	await db
		.update(presenceSessions)
		.set({
			discordToken: session.token,
			activity: discordActivity
		})
		.where(eq(presenceSessions.discordLinkId, discordLinkId));

	await recordPublishSuccess(discordLinkId);
}

export async function endDiscordHeadlessSession(discordLinkId: string) {
	const presenceSession = await db
		.select()
		.from(presenceSessions)
		.where(eq(presenceSessions.discordLinkId, discordLinkId))
		.get();

	if (presenceSession?.discordToken == null) return;

	try {
		const discordAccessToken = await getDiscordAccessTokenForLink(discordLinkId);

		const response = await fetch('https://discord.com/api/v10/users/@me/headless-sessions/delete', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${discordAccessToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				token: presenceSession.discordToken
			})
		});

		if (!response.ok) {
			const errorResponse = await response.text();

			console.warn(
				'[DiscordAuth] Ending Discord headless session failed (%d): %s',
				response.status,
				errorResponse
			);
		}
	} catch (error) {
		console.warn('[DiscordAuth] Ending Discord headless session failed:', error);
	}

	await db
		.update(presenceSessions)
		.set({ discordToken: null, activity: null, publishedAt: null })
		.where(eq(presenceSessions.discordLinkId, discordLinkId));
}

export async function revokeDiscordAuth(discordLinkId: string) {
	const discordUser = await db
		.select()
		.from(discordLinks)
		.where(eq(discordLinks.id, discordLinkId))
		.get();

	if (discordUser == null) {
		throw new Error('Discord account is not linked.');
	}

	const discordClientId = process.env.DISCORD_CLIENT_ID;
	const discordClientSecret = process.env.DISCORD_CLIENT_SECRET;

	if (discordClientId == null || discordClientSecret == null) {
		console.error('null discordClientId or secret found.');
		throw new Error("Discord Client ID or secret can't be null or undefined");
	}

	const response = await fetch('https://discord.com/api/oauth2/token/revoke', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body: new URLSearchParams({
			client_id: discordClientId,
			client_secret: discordClientSecret,
			token: discordUser.discordAuth.refresh_token,
			token_type_hint: 'refresh_token'
		})
	});

	if (!response.ok) {
		const errorBody = await response.text();
		const parsed = parseDiscordError(errorBody);

		if (
			response.status === 400 &&
			(parsed.error === 'invalid_grant' || parsed.error === 'invalid_request')
		) {
			console.warn('[DiscordAuth] Grant was already invalid when revoking: %s', errorBody);
			return;
		}

		console.error('Discord token revoke failed (%d): %s', response.status, errorBody);
		throw new Error('Failed to revoke Discord authorisation.');
	}
}
