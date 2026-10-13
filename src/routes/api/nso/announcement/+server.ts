import { error } from '@sveltejs/kit';
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

	const appVersion = '3.5.0';
	const upstream = await fetch(parsed, {
		headers: {
			'user-agent': `com.nintendo.znca/${appVersion}(iOS/27.2) WebView`,
			accept: 'text/html,application/xhtml+xml'
		},
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
	}).catch(() => null);

	if (!upstream) {
		throw error(502, 'Could not load announcement');
	}

	if (!upstream.ok) {
		throw error(upstream.status, 'Could not load announcement');
	}

	return new Response(stripTracking(await upstream.text(), parsed.href), {
		headers: {
			'content-type': 'text/html; charset=utf-8',
			'cache-control': 'private, max-age=3600',
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
				if (attribs.href) {
					attribs.href = new URL(attribs.href, baseUrl).href;
				}

				return {
					tagName,
					attribs: {
						...attribs,
						target: '_blank',
						rel: 'noopener noreferrer'
					}
				};
			}
		}
	});
}
