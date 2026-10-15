import { invalidateCoralFriends } from '$lib/server/coral.js';
import { db } from '$lib/server/db/index.js';
import { discordLinks } from '$lib/server/db/schema.js';
import { exchangeCallbackCode, fetchDiscordUser } from '$lib/server/utils/DiscordAuth.js';
import { ensureBotFriendship } from '$lib/server/utils/NintendoAuth.js';
import { error, isHttpError, isRedirect, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';

export async function GET({ locals, cookies, url }) {
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

		await db.insert(discordLinks).values({
			nintendoAccountId: locals.nintendoAccount.id,
			discordUserId: user.id,
			discordUsername: user.username,
			discordAvatar: user.avatar,
			discordAuth: {
				expires_time: expiresAt,
				...tokens
			}
        });

        const botFriendship = await ensureBotFriendship(locals.nintendoAccount);

        if (botFriendship == 'complete') {
            invalidateCoralFriends(locals.nintendoAccount.id);
        }

		redirect(303, '/settings');
	} catch (err) {
		if (isHttpError(err) || isRedirect(err)) throw err;

		console.error('Linking failed:', err);

		throw error(500, 'An error occurred while linking.');
	}
}
