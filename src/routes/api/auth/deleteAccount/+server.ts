import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { decodeJwt } from 'jose';
import { NintendoAccountSessionAuthorisationCoral } from 'nxapi/coral';
import { endDiscordHeadlessSession, revokeDiscordAuth } from '$lib/server/utils/DiscordAuth';
import { clearAccountCaches } from '$lib/server/coral';
import { removeBotFriendship } from '$lib/server/utils/NintendoAuth';
import { db } from '$lib/server/db';
import { discordLinks, nintendoAccount, sessions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.nintendoAccount) {
		throw error(401, 'Authentication required');
	}

	const authenticator = NintendoAccountSessionAuthorisationCoral.create();

	return json({
		authoriseUrl: authenticator.authorise_url,
		state: authenticator.state,
		verifier: authenticator.verifier
	});
};

export const POST: RequestHandler = async ({ locals, request, cookies }) => {
	if (!locals.nintendoAccount) {
		throw error(401, 'Authentication required');
	}
	const user = locals.nintendoAccount;

	const body = await request.json();

	const redirectURI = body.redirectURI as string | undefined;
	const authoriseUrl = body.authoriseUrl as string | undefined;
	const state = body.state as string | undefined;
	const verifier = body.verifier as string | undefined;

	if (
		typeof redirectURI !== 'string' ||
		typeof authoriseUrl !== 'string' ||
		typeof state !== 'string' ||
		typeof verifier !== 'string'
	) {
		throw error(400, 'Invalid request');
	}

	let sessionToken: string;
	try {
		const authenticator = NintendoAccountSessionAuthorisationCoral.resume(
			authoriseUrl,
			state,
			verifier
		);
		const result = await authenticator.getSessionToken(
			new URLSearchParams(new URL(redirectURI).hash.substring(1))
		);
		sessionToken = result.session_token;
	} catch (cause) {
		console.warn('[deleteAccount] Verification failed', cause);
		throw error(400, 'Invalid Session Token');
	}

	if (decodeJwt(sessionToken).sub !== user.naId) {
		throw error(403, 'Invalid Session Token');
	}

	const discordLink = await db
		.select()
		.from(discordLinks)
		.where(eq(discordLinks.nintendoAccountId, user.id))
		.get();

	if (discordLink) {
		try {
			await endDiscordHeadlessSession(discordLink.id);
			await revokeDiscordAuth(discordLink.id);
		} catch (cause) {
			console.warn('[deleteAccount] Could not clean up Discord link', cause);
		}
	}

	const unfriended = await removeBotFriendship(user);

	if (!unfriended) {
		throw error(502, 'Could not remove the system bot friendship. Please try again.');
	}

	await db.transaction(async (tx) => {
		await tx.delete(sessions).where(eq(sessions.nintendoAccountId, user.id));
		await tx.delete(nintendoAccount).where(eq(nintendoAccount.id, user.id));
	});

	clearAccountCaches(user.id);
	cookies.delete('session', { path: '/' });

	return json({ ok: true });
};
