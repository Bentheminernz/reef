import { sequence } from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
import 'dotenv/config';
import '$lib/server/nxapi';
import { verifySession } from '$lib/server/session';
import { db } from '$lib/server/db';
import { nintendoAccount, sessions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { redirect, type Handle } from '@sveltejs/kit';
import { getCurrentPrivacyPolicy, hasAcceptedPrivacyPolicy } from '$lib/server/policy';
import { isAdmin } from '$lib/server/admin';

const WEBVIEW_REFERRER = /^\/api\/nso\/webview\/([0-9a-f-]{36})\/proxy(?:\/|$)/i;
const POLICY_EXEMPT_PREFIXES = ['/accept-privacy', '/privacy', '/login'];

export const handle: Handle = sequence(Sentry.sentryHandle(), async ({ event, resolve }) => {
	const jwt = event.cookies.get('session');

	if (jwt) {
		const sid = await verifySession(jwt);

		if (sid) {
			const row = await db
				.select({
					account: nintendoAccount,
					session: sessions
				})
				.from(sessions)
				.innerJoin(nintendoAccount, eq(sessions.nintendoAccountId, nintendoAccount.id))
				.where(eq(sessions.id, sid))
				.get();

			if (row && row.session.expiresAt > new Date()) {
				event.locals.nintendoAccount = row.account;
			}
		}
	}

	const policyExempt = POLICY_EXEMPT_PREFIXES.some((prefix) =>
		event.url.pathname.startsWith(prefix)
	);

	event.locals.isAdmin = isAdmin(event.locals.nintendoAccount?.naId ?? null);

	if (event.locals.nintendoAccount && !policyExempt) {
		const policy = await getCurrentPrivacyPolicy();

		if (
			policy != null &&
			!(await hasAcceptedPrivacyPolicy(event.locals.nintendoAccount.id, policy.id))
		) {
			const redirectTo = event.url.pathname + event.url.search;
			redirect(303, `/accept-privacy?redirectTo=${encodeURIComponent(redirectTo)}`);
		}
	}

	if (event.locals.nintendoAccount && !event.url.pathname.startsWith('/api/nso/webview/')) {
		const referrer = event.request.headers.get('referer');
		if (referrer) {
			try {
				const source = new URL(referrer);
				const sessionId =
					source.origin === event.url.origin
						? source.pathname.match(WEBVIEW_REFERRER)?.[1]
						: undefined;

				if (sessionId) {
					const location = `/api/nso/webview/${sessionId}/proxy${event.url.pathname}${event.url.search}`;
					return new Response(null, {
						status: 307,
						headers: {
							Location: location,
							'Cache-Control': 'private, no-store'
						}
					});
				}
			} catch {
				// invalid go through sveltekit
			}
		}
	}

	return resolve(event);
});

type ErrorHandlerInput = {
	error: unknown;
	event?: { url?: URL };
	status?: number;
	message?: string;
};

export const handleError = Sentry.handleErrorWithSentry(
	({ error, status, message, event }: ErrorHandlerInput) => {
		if (status === 404) return;

		const pathname = event?.url?.pathname ?? '';
		console.error(`[${status}] ${pathname}: ${message}`, error);
	}
);
