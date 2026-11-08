import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { resolve } from '$app/paths';
import sanitizeHtml from 'sanitize-html';
import type { RequestHandler } from './$types';

const ALLOWED_HOST = 'web-lp1.znc.srv.nintendo.net';
const FETCH_TIMEOUT_MS = 10_000;

export const GET: RequestHandler = async ({ locals, url, fetch }) => {
	if (!locals.nintendoAccount) {
		throw error(401, 'Authentication required');
	}

	const target = url.searchParams.get('url');
	if (!target) {
		throw error(400, 'Missing announcement URL');
	}

	let parsed: URL;
	try {
		parsed = new URL(target);
	} catch {
		throw error(400, 'Invalid announcement URL');
	}

	if (parsed.protocol !== 'https:' || parsed.hostname !== ALLOWED_HOST) {
		throw error(400, 'Unsupported announcement URL');
	}

	const appVersion = locals.nintendoAccount.coralAuthData?.znca_version;
	if (!appVersion) {
		throw error(503, 'Nintendo Switch app version is unavailable. Please sign in again.');
	}

	const upstream = await fetch(parsed, {
		headers: {
			'User-Agent': `com.nintendo.znca/${appVersion}(iOS/27.2) WebView`,
			Accept: 'text/html,application/xhtml+xml'
		},
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
	})

	if (!upstream) {
		throw error(502, 'Could not load announcement');
	}

	const text = await upstream.text();

	if (!upstream.ok) {
		throw error(upstream.status, 'Could not load announcement');
	}

	return new Response(stripTracking(text, parsed.href), {
		headers: {
			'content-type': 'text/html; charset=utf-8',
			'cache-control': dev ? 'no-store' : 'private, max-age=3600',
			'content-security-policy': "script-src 'none'; object-src 'none'; frame-ancestors 'self'",
			'x-content-type-options': 'nosniff',
			'X-Hello': 'Hello there snooper. This HTML was stripped by ben :)'
		}
	});
};

function stripTracking(html: string, baseUrl: string): string {
	return sanitizeHtml(html, {
		allowedTags: false,
		allowedAttributes: false,
		allowVulnerableTags: true,
		exclusiveFilter: (frame) => frame.tag === 'script',
		transformTags: {
			a: (tagName, attribs) => {
				let isGameService = false;
				if (attribs.href) {
					try {
						const link = new URL(attribs.href, baseUrl);
						const game = link.pathname.match(/^\/game\/(\d{1,16})\/?$/);
						if (
							link.protocol === 'com.nintendo.znca:' &&
							link.host === 'znca' &&
							!link.username &&
							!link.password &&
							game !== null &&
							Number.isSafeInteger(Number(game[1]))
						) {
							attribs.href = `${resolve('/')}?gameService=${game[1]}`;
							isGameService = true;
						} else {
							attribs.href = link.href;
						}
					} catch {
						delete attribs.href;
					}
				}

				return {
					tagName,
					attribs: {
						...attribs,
						target: isGameService ? '_top' : '_blank',
						rel: 'noopener noreferrer'
					},
					...(isGameService ? { text: 'Open in Reef' } : {})
				};
			}
		}
	});
}
