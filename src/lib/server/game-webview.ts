// once again this code is inspired by dycool/nso-webapp, and has improvements in many areas

import { randomUUID } from 'node:crypto';
import { and, eq, lt } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import {
	gameWebServiceTokens,
	gameWebviewSessions,
	type WebviewCookie
} from '$lib/server/db/schema';
import { buildWebviewHtml } from '$lib/server/standalone-webview';
import {
	NOOKLINK_API_ORIGIN,
	NOOKLINK_DPL_ORIGIN,
	SMASH_WORLD_CDN_ORIGIN,
	SPLATNET3_API_ORIGIN,
	TRUSTED_NINTENDO_DOMAINS
} from '$lib/server/webviewDomains';
import type { GameService, GameServiceSession } from '$lib/types/game-services';

const SESSION_LIFETIME = 2 * 60 * 60 * 1000;
const SPLATNET3_ID = 4834290508791808;
const NOOKLINK_ID = 4953919198265344;
const SMASH_WORLD_IDS = new Set([5598642853249024, 5614999764533248]);
const ZELDA_NOTES_IDS = new Set([5935781783175168, 4974384874151936]);
const cookieWrites = new Map<string, Promise<void>>();

type GameWebviewSession = typeof gameWebviewSessions.$inferSelect;

export async function createGameWebviewSession(
	accountId: string,
	service: GameService,
	language: string,
	country: string
): Promise<GameServiceSession> {
	const initialUrl = new URL(service.uri);
	if (!isStrictNintendoUrl(initialUrl)) throw new Error('Nintendo service URL is not allowed');

	const id = randomUUID();
	const expiresAt = new Date(Date.now() + SESSION_LIFETIME);
	const allowedOrigins = resolveAllowedOrigins(service);
	if (ZELDA_NOTES_IDS.has(service.id) && initialUrl.pathname === '/') {
		initialUrl.pathname = '/title-select';
	}
	initialUrl.searchParams.set('lang', initialUrl.searchParams.get('lang') || language);
	initialUrl.searchParams.set('na_lang', initialUrl.searchParams.get('na_lang') || language);
	initialUrl.searchParams.set('na_country', initialUrl.searchParams.get('na_country') || country);

	await db.delete(gameWebviewSessions).where(lt(gameWebviewSessions.expiresAt, new Date()));
	await db.insert(gameWebviewSessions).values({
		id,
		nintendoAccountId: accountId,
		serviceId: service.id,
		serviceUri: initialUrl.toString(),
		allowedOrigins,
		language,
		country,
		cookies: [],
		expiresAt
	});

	return {
		sessionId: id,
		webviewUrl: `/api/nso/webview/${id}/proxy?url=${encodeURIComponent(initialUrl.toString())}`,
		expiresAt: expiresAt.getTime()
	};
}

export async function closeGameWebviewSession(accountId: string, sessionId: string): Promise<void> {
	await db
		.delete(gameWebviewSessions)
		.where(
			and(
				eq(gameWebviewSessions.id, sessionId),
				eq(gameWebviewSessions.nintendoAccountId, accountId)
			)
		);
}

export async function getGameWebviewSession(
	accountId: string,
	sessionId: string
): Promise<GameWebviewSession | null> {
	const session = await db
		.select()
		.from(gameWebviewSessions)
		.where(
			and(
				eq(gameWebviewSessions.id, sessionId),
				eq(gameWebviewSessions.nintendoAccountId, accountId)
			)
		)
		.get();

	if (!session) return null;
	if (session.expiresAt.getTime() > Date.now()) return session;
	await closeGameWebviewSession(accountId, sessionId);
	return null;
}

export async function proxyGameWebviewRequest(
	request: Request,
	accountId: string,
	sessionId: string,
	restPath = ''
): Promise<Response> {
	const session = await getGameWebviewSession(accountId, sessionId);
	if (!session) return new Response('Game-service session expired.', { status: 401 });

	const requestUrl = new URL(request.url);
	const explicitUrl = restPath ? null : requestUrl.searchParams.get('url');

	let targetUrl: URL;

	try {
		if (explicitUrl) {
			targetUrl = new URL(explicitUrl.replace(/&amp;/gi, '&'));

			for (const [name, value] of requestUrl.searchParams) {
				if (name !== 'url') targetUrl.searchParams.set(name, value);
			}
		} else {
			const path = `/${restPath}`.replace(/\/{2,}/g, '/');
			const base =
				isNookLink(session) && /^\/api\/sd\/v1(?:\/|$)/.test(path)
					? NOOKLINK_API_ORIGIN
					: new URL(session.serviceUri).origin;
			targetUrl = new URL(`${path}${requestUrl.search}`, base);
		}
	} catch {
		return new Response('Invalid game-service URL.', { status: 400 });
	}

	if (!isAllowedServiceUrl(session, targetUrl, request.method)) {
		return new Response('Game-service destination is not allowed.', { status: 403 });
	}

	const token = await db
		.select({ token: gameWebServiceTokens.token, expiresAt: gameWebServiceTokens.expiresAt })
		.from(gameWebServiceTokens)
		.where(
			and(
				eq(gameWebServiceTokens.nintendoAccountId, accountId),
				eq(gameWebServiceTokens.serviceId, session.serviceId)
			)
		)
		.get();
	if (!token || token.expiresAt.getTime() <= Date.now()) {
		return new Response('Game-service token expired.', { status: 401 });
	}

	const cookieJar = new CookieJar(session.cookies);
	const headers = createUpstreamHeaders(
		request.headers,
		session,
		targetUrl,
		cookieJar,
		token.token
	);
	const body = ['GET', 'HEAD'].includes(request.method)
		? undefined
		: new Uint8Array(await request.arrayBuffer());

	let upstream: Response;
	try {
		upstream = await fetch(targetUrl, {
			method: request.method,
			headers,
			body,
			redirect: 'manual',
			signal: request.signal
		});
	} catch (cause) {
		console.warn('[GameWebviewProxy] Nintendo request failed', {
			serviceId: session.serviceId,
			origin: targetUrl.origin,
			path: targetUrl.pathname,
			error: cause instanceof Error ? cause.message : String(cause)
		});
		return new Response('Nintendo game service is unavailable.', { status: 502 });
	}

	if (isNookLink(session) && targetUrl.pathname.startsWith('/api/sd/v1/')) {
		let serviceError: string | undefined;
		try {
			const payload = (await upstream.clone().json()) as {
				error?: string;
				error_message?: string;
				message?: string;
			};
			serviceError =
				payload.error_message || payload.error || (!upstream.ok ? payload.message : undefined);
		} catch {
			// Some successful NookLink endpoints do not return JSON.
		}
		const diagnostic = {
			method: request.method,
			path: targetUrl.pathname,
			status: upstream.status,
			hasGToken: cookieJar.getCookies().some((cookie) => cookie.name === '_gtoken'),
			serviceError
		};
		if (!upstream.ok || serviceError) console.warn('[NookLinkApiError]', diagnostic);
		else console.info('[NookLinkApi]', diagnostic);
	}

	await persistResponseCookies(session.id, targetUrl, upstream.headers);
	const responseHeaders = createBrowserHeaders(upstream.headers);
	const location = upstream.headers.get('location');
	if (location) {
		try {
			const redirect = new URL(location, targetUrl);
			if (isAllowedServiceUrl(session, redirect, 'GET')) {
				responseHeaders.set(
					'location',
					`/api/nso/webview/${session.id}/proxy?url=${encodeURIComponent(redirect.toString())}`
				);
			} else {
				responseHeaders.delete('location');
			}
		} catch {
			responseHeaders.delete('location');
		}
	}

	if (request.method === 'HEAD' || upstream.status === 204 || upstream.status === 304) {
		return new Response(null, { status: upstream.status, headers: responseHeaders });
	}

	const contentType = upstream.headers.get('content-type') || '';
	if (/text\/html|application\/xhtml\+xml/i.test(contentType)) {
		const html = buildWebviewHtml({
			sessionId: session.id,
			serviceId: String(session.serviceId),
			serviceUri: session.serviceUri,
			currentTargetUrl: targetUrl.toString(),
			allowedOrigins: session.allowedOrigins,
			initialHtml: await upstream.text()
		});
		responseHeaders.delete('etag');
		responseHeaders.delete('last-modified');
		return new Response(html, { status: upstream.status, headers: responseHeaders });
	}

	if (/text\/css/i.test(contentType)) {
		const css = rewriteCss(await upstream.text(), session, targetUrl);
		responseHeaders.delete('etag');
		responseHeaders.delete('last-modified');
		return new Response(css, { status: upstream.status, headers: responseHeaders });
	}

	return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

function createUpstreamHeaders(
	incoming: Headers,
	session: GameWebviewSession,
	targetUrl: URL,
	cookieJar: CookieJar,
	token: string
): Headers {
	const headers = new Headers();
	const incomingOrigin = incoming.get('origin');
	const incomingReferer = incoming.get('referer');
	for (const [name, value] of incoming) {
		if (
			[
				'host',
				'connection',
				'content-length',
				'cookie',
				'accept-encoding',
				'origin',
				'referer',
				'cf-connecting-ip',
				'x-forwarded-for',
				'x-forwarded-host',
				'x-forwarded-proto'
			].includes(name.toLowerCase())
		) {
			continue;
		}
		headers.set(name, value);
	}

	const isStatic = /\.(?:js|mjs|css|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|mp4|webm)$/i.test(
		targetUrl.pathname
	);
	const cookies = cookieJar.getCookieHeader(targetUrl);
	if (cookies) headers.set('cookie', cookies);

	const cookieEntries = cookieJar.getCookies();
	const isNook = isNookLink(session);
	const isSmash = isSmashWorld(session);
	const isZelda = ZELDA_NOTES_IDS.has(session.serviceId);
	const hasGToken = cookieEntries.some((cookie) => cookie.name === '_gtoken');
	const hasSmashSession = cookieEntries.some((cookie) =>
		/(?:super_smash_session|session)/i.test(cookie.name)
	);
	const hasZeldaSession = cookieEntries.some((cookie) => /(?:a5_token|session)/i.test(cookie.name));
	const initialNookDocument =
		isNook &&
		!hasGToken &&
		targetUrl.origin === new URL(session.serviceUri).origin &&
		!targetUrl.pathname.startsWith('/api/');

	let attachGameToken: boolean;
	if (session.serviceId === SPLATNET3_ID) {
		attachGameToken =
			targetUrl.pathname === '/api/bullet_tokens' || targetUrl.pathname === '/api/primer_tokens';
	} else if (isNook) {
		attachGameToken = initialNookDocument;
	} else if (isZelda) {
		attachGameToken = !hasZeldaSession && !isStatic;
	} else if (isSmash) {
		attachGameToken = !hasSmashSession && !isStatic;
	} else {
		attachGameToken = !isStatic;
	}

	if (attachGameToken) {
		headers.set('x-gamewebtoken', token);
	} else {
		headers.delete('x-gamewebtoken');
	}

	const appVersion = env.CORAL_VERSION || '3.4.1';
	const iosUa =
		'Mozilla/5.0 (iPhone; CPU iPhone OS 15_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.3 Mobile/15E148 Safari/604.1';
	const androidUa = `Mozilla/5.0 (Linux; Android 10; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120 Mobile Safari/537.36 com.nintendo.znca/${appVersion}`;
	headers.set('user-agent', isNook || isSmash ? iosUa : androidUa);
	if (isNook || isSmash) {
		for (const name of [
			'sec-ch-ua',
			'sec-ch-ua-mobile',
			'sec-ch-ua-platform',
			'sec-ch-ua-platform-version',
			'sec-ch-ua-arch',
			'sec-ch-ua-bitness',
			'sec-ch-ua-full-version',
			'sec-ch-ua-full-version-list',
			'sec-ch-ua-model'
		]) {
			headers.delete(name);
		}
	}
	if (isNook) {
		headers.delete('if-none-match');
		headers.delete('if-modified-since');
	}
	headers.set('x-appplatform', 'android');
	headers.set('x-appcolorscheme', 'DARK');
	headers.set('x-requested-with', 'com.nintendo.znca');
	headers.set('x-nacountry', session.country);
	headers.set('accept-language', session.language);
	const serviceOrigin = new URL(session.serviceUri).origin;
	if (isNook || isSmash) {
		if (incomingOrigin) headers.set('origin', serviceOrigin);
		else headers.delete('origin');
		if (incomingReferer) headers.set('referer', `${serviceOrigin}/`);
		else headers.delete('referer');
	} else {
		headers.set('origin', targetUrl.origin);
		headers.set('referer', `${targetUrl.origin}/`);
	}
	if (initialNookDocument) {
		headers.delete('cookie');
		headers.set('dnt', '0');
		headers.set('x-isappanalyticsoptedin', 'false');
	}
	if (isSmash && !hasSmashSession) {
		headers.delete('origin');
		headers.delete('referer');
		headers.set('upgrade-insecure-requests', '1');
	}
	return headers;
}

function createBrowserHeaders(upstream: Headers): Headers {
	const headers = new Headers();
	for (const [name, value] of upstream) {
		if (
			[
				'content-length',
				'content-encoding',
				'transfer-encoding',
				'set-cookie',
				'content-security-policy',
				'content-security-policy-report-only',
				'x-frame-options'
			].includes(name.toLowerCase())
		) {
			continue;
		}
		headers.append(name, value);
	}
	headers.set('cache-control', 'private, no-store');
	headers.set('referrer-policy', 'same-origin');

	return headers;
}

function rewriteCss(css: string, session: GameWebviewSession, targetUrl: URL): string {
	const urls = css.replace(/url\((['"]?)([^)'"\s]+)\1\)/gi, (match, quote, value) => {
		if (/^(?:data:|blob:|#)/i.test(value)) return match;
		return `url(${quote}${toProxyUrl(value, session, targetUrl)}${quote})`;
	});
	return urls.replace(/(@import\s+)(['"])([^'"]+)\2/gi, (match, prefix, quote, value) => {
		if (/^(?:data:|blob:)/i.test(value)) return match;
		return `${prefix}${quote}${toProxyUrl(value, session, targetUrl)}${quote}`;
	});
}

function toProxyUrl(raw: string, session: GameWebviewSession, currentUrl: URL): string {
	if (raw.startsWith('/api/nso/webview/')) return raw;
	try {
		const target = new URL(raw.startsWith('//') ? `https:${raw}` : raw, currentUrl);
		if (!isAllowedServiceUrl(session, target, 'GET')) return raw;
		return `/api/nso/webview/${session.id}/proxy?url=${encodeURIComponent(target.toString())}`;
	} catch {
		return raw;
	}
}

function resolveAllowedOrigins(service: GameService): string[] {
	const values = new Set<string>([new URL(service.uri).origin]);
	for (const entry of service.whiteList) {
		const value = entry.trim().toLowerCase();
		if (!value) continue;
		const host = value.replace(/^https?:\/\//, '').split('/')[0];
		const checkHost = host.startsWith('*.') ? host.slice(2) : host;
		if (isStrictNintendoUrl(new URL(`https://${checkHost}`))) values.add(`https://${host}`);
	}
	if (service.id === SPLATNET3_ID) values.add(SPLATNET3_API_ORIGIN);
	if (service.id === NOOKLINK_ID) {
		values.add(NOOKLINK_API_ORIGIN);
		values.add(NOOKLINK_DPL_ORIGIN);
	}
	if (SMASH_WORLD_IDS.has(service.id)) {
		values.add(SMASH_WORLD_CDN_ORIGIN);
	}
	return [...values];
}

function isAllowedServiceUrl(session: GameWebviewSession, target: URL, method: string): boolean {
	if (!isStrictNintendoUrl(target)) return false;
	if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return false;
	return session.allowedOrigins.some((entry) => {
		const host = entry
			.replace(/^https?:\/\//, '')
			.split('/')[0]
			.toLowerCase();
		if (host.startsWith('*.')) {
			const suffix = host.slice(2);
			return target.hostname === suffix || target.hostname.endsWith(`.${suffix}`);
		}
		return target.hostname === host;
	});
}

function isStrictNintendoUrl(value: URL): boolean {
	if (value.protocol !== 'https:') return false;
	const hostname = value.hostname.toLowerCase();
	if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname)) return false;
	if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
		return false;
	}
	return TRUSTED_NINTENDO_DOMAINS.some(
		(domain) => hostname === domain || hostname.endsWith(`.${domain}`)
	);
}

function isNookLink(session: GameWebviewSession): boolean {
	return session.serviceId === NOOKLINK_ID || session.serviceUri.includes('acbaa');
}

function isSmashWorld(session: GameWebviewSession): boolean {
	return SMASH_WORLD_IDS.has(session.serviceId) || session.serviceUri.includes('smash');
}

async function persistResponseCookies(sessionId: string, targetUrl: URL, headers: Headers) {
	const setCookies = getSetCookies(headers);
	if (!setCookies.length) return;

	const previous = cookieWrites.get(sessionId) || Promise.resolve();
	const write = previous
		.catch(() => undefined)
		.then(async () => {
			const current = await db
				.select({ cookies: gameWebviewSessions.cookies })
				.from(gameWebviewSessions)
				.where(eq(gameWebviewSessions.id, sessionId))
				.get();
			if (!current) return;
			const jar = new CookieJar(current.cookies);
			for (const value of setCookies) jar.addSetCookie(value, targetUrl);
			await db
				.update(gameWebviewSessions)
				.set({ cookies: jar.toJSON() })
				.where(eq(gameWebviewSessions.id, sessionId));
		})
		.finally(() => {
			if (cookieWrites.get(sessionId) === write) cookieWrites.delete(sessionId);
		});
	cookieWrites.set(sessionId, write);
	await write;
}

function getSetCookies(headers: Headers): string[] {
	const values = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.();
	if (values?.length) return values;
	const value = headers.get('set-cookie');
	return value ? [value] : [];
}

class CookieJar {
	private cookies: WebviewCookie[];

	constructor(cookies: WebviewCookie[]) {
		this.cookies = [...cookies];
	}

	getCookies() {
		this.removeExpired();
		return [...this.cookies];
	}

	toJSON() {
		this.removeExpired();
		return this.cookies;
	}

	getCookieHeader(target: URL): string {
		this.removeExpired();
		return this.cookies
			.filter((cookie) => {
				if (cookie.secure && target.protocol !== 'https:') return false;
				if (cookie.hostOnly) {
					if (cookie.domain !== target.hostname) return false;
				} else if (
					target.hostname !== cookie.domain &&
					!target.hostname.endsWith(`.${cookie.domain}`)
				) {
					return false;
				}
				return cookie.path === '/' || target.pathname.startsWith(cookie.path);
			})
			.sort((a, b) => b.path.length - a.path.length)
			.map((cookie) => `${cookie.name}=${cookie.value}`)
			.join('; ');
	}

	addSetCookie(raw: string, currentUrl: URL) {
		const parts = raw.split(';').map((part) => part.trim());
		const separator = parts[0]?.indexOf('=') ?? -1;
		if (separator <= 0) return;
		const name = parts[0].slice(0, separator);
		const value = parts[0].slice(separator + 1);
		let domain = currentUrl.hostname.toLowerCase();
		let hostOnly = true;
		let path = currentUrl.pathname.slice(0, currentUrl.pathname.lastIndexOf('/') + 1) || '/';
		let secure = false;
		let httpOnly = false;
		let expires: number | undefined;

		for (const part of parts.slice(1)) {
			const [rawName, ...rawValue] = part.split('=');
			const attribute = rawName.toLowerCase();
			const attributeValue = rawValue.join('=');
			if (attribute === 'domain' && attributeValue) {
				const candidate = attributeValue.replace(/^\./, '').toLowerCase();
				if (currentUrl.hostname === candidate || currentUrl.hostname.endsWith(`.${candidate}`)) {
					domain = candidate;
					hostOnly = false;
				}
			} else if (attribute === 'path' && attributeValue) path = attributeValue;
			else if (attribute === 'secure') secure = true;
			else if (attribute === 'httponly') httpOnly = true;
			else if (attribute === 'max-age') expires = Date.now() + Number(attributeValue) * 1000;
			else if (attribute === 'expires' && expires === undefined)
				expires = Date.parse(attributeValue);
		}

		this.cookies = this.cookies.filter(
			(cookie) => !(cookie.name === name && cookie.domain === domain && cookie.path === path)
		);
		if (!expires || expires > Date.now()) {
			this.cookies.push({ name, value, domain, path, hostOnly, secure, httpOnly, expires });
		}
	}

	private removeExpired() {
		const now = Date.now();
		this.cookies = this.cookies.filter((cookie) => !cookie.expires || cookie.expires > now);
	}
}
