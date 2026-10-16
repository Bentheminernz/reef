import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { endDiscordHeadlessSession, revokeDiscordAuth } from '$lib/server/utils/DiscordAuth';
import { removeBotFriendship } from '$lib/server/utils/NintendoAuth';
import { db } from '$lib/server/db';
import { discordLinks, presenceSessions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

const handle: RequestHandler = async ({ locals }) => {
	if (!locals.nintendoAccount) {
		throw error(401, 'Authentication required');
	}

	const user = locals.nintendoAccount;
	const discordLink = await db
		.select({
			id: discordLinks.id
		})
		.from(discordLinks)
		.where(eq(discordLinks.nintendoAccountId, user.id))
		.get();

	if (discordLink == null) {
		throw error(400, 'No Discord account is linked.');
	}

	try {
		await endDiscordHeadlessSession(discordLink.id);
	} catch (cause) {
		console.error('[discord/revoke] Failed to end Discord presence session', cause);
	}

	try {
		await revokeDiscordAuth(discordLink.id);
	} catch (cause) {
		console.error('[discord/revoke] Failed to revoke Discord authorisation', cause);
		throw error(502, 'Could not revoke Discord access. Please try again.');
	}

	await db.transaction(async (tx) => {
		await tx.delete(presenceSessions).where(eq(presenceSessions.discordLinkId, discordLink.id));
		await tx.delete(discordLinks).where(eq(discordLinks.id, discordLink.id));
	});

	await removeBotFriendship(user);

	return json({ ok: true });
};

export const POST = handle;
export const DELETE = handle;
