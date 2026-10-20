import { invalidateCoralFriends } from '$lib/server/coral.js';
import { db } from '$lib/server/db/index.js';
import { discordLinks, presenceSessions, siteSetting } from '$lib/server/db/schema.js';
import { exchangeCallbackCode, fetchDiscordUser } from '$lib/server/utils/DiscordAuth.js';
import { ensureBotFriendship } from '$lib/server/utils/NintendoAuth.js';
import { error, isHttpError, isRedirect, redirect } from '@sveltejs/kit';
import { count, eq } from 'drizzle-orm';

export async function GET({ locals, cookies, url }) {
	const siteSettings = await db
		.select()
		.from(siteSetting)
		.where(eq(siteSetting.id, 1))
		.limit(1)
		.get();

	if (!siteSettings || !siteSettings.discordEnrolmentEnabled) {
		throw error(403, 'Discord enrolment is currently disabled');
	}

	const [{ count: totalLinks }] = await db.select({ count: count() }).from(discordLinks);

	if (totalLinks >= siteSettings.discordEnrolmentLimit) {
		throw error(403, 'Discord enrolment has reached its limit');
	}

	const discordError = url.searchParams.get('error');

	if (discordError != null) {
		const description = url.searchParams.get('error_description');

		console.error('Discord OAuth Error:', {
			error: discordError,
			description
		});

		throw error(400, 'Discord authorisation failed.');
	}

	if (!locals.nintendoAccount) {
		throw error(401, 'Authentication required.');
	}

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');

	if (code == null || state == null) {
		throw error(400, 'Invalid callback.');
	}

	const savedState = cookies.get('discord_auth_state');

	if (state !== savedState) {
		throw error(400, 'State mismatch.');
	}

	cookies.delete('discord_auth_state', {
		path: '/'
	});

	let linkId: string | null = null;

	try {
		const existingLink = await db
			.select({ id: discordLinks.id })
			.from(discordLinks)
			.where(eq(discordLinks.nintendoAccountId, locals.nintendoAccount.id))
			.get();

		if (existingLink != null) {
			throw error(409, 'This account is already linked to a Discord account.');
		}

		const tokens = await exchangeCallbackCode(code);
		const user = await fetchDiscordUser(tokens.access_token);

		const linkedElsewhere = await db
			.select({ id: discordLinks.id })
			.from(discordLinks)
			.where(eq(discordLinks.discordUserId, user.id))
			.get();

		if (linkedElsewhere != null) {
			throw error(409, 'This Discord account is already linked to another account.');
		}

		const expiresAt = Math.floor(Date.now() / 1000) + tokens.expires_in;

		const [link] = await db
			.insert(discordLinks)
			.values({
				nintendoAccountId: locals.nintendoAccount.id,
				discordUserId: user.id,
				discordUsername: user.username,
				discordAvatar: user.avatar,
				discordAuth: {
					expires_time: expiresAt,
					...tokens
				}
			})
			.returning({ id: discordLinks.id });

		linkId = link.id;

		const botFriendship = await ensureBotFriendship(locals.nintendoAccount);

		if (botFriendship !== 'complete') {
			await rollbackDiscordLink(link.id);
			linkId = null;

			redirect(303, `/settings?discordError=${botFriendship}`);
		}

		invalidateCoralFriends(locals.nintendoAccount.id);

		redirect(303, '/settings');
	} catch (err) {
		if (isHttpError(err) || isRedirect(err)) throw err;

		if (linkId != null) {
			await rollbackDiscordLink(linkId).catch((error) =>
				console.error('Failed to roll back Discord link after error', error)
			);
		}

		console.error('Linking failed:', err);

		redirect(303, '/settings?discordError=unassigned');
	}
}

async function rollbackDiscordLink(linkId: string): Promise<void> {
	await db.transaction(async (tx) => {
		await tx.delete(presenceSessions).where(eq(presenceSessions.discordLinkId, linkId));
		await tx.delete(discordLinks).where(eq(discordLinks.id, linkId));
	});
}
