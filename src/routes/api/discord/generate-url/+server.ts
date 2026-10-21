import { dev } from '$app/environment';
import { hasSystemBotCapacity } from '$lib/server/utils/NintendoAuth.js';
import { generateDiscordAuthURL } from '$lib/server/utils/DiscordAuth.js';
import { error, json } from '@sveltejs/kit';

export async function GET({ cookies, locals }) {
	if (!locals.nintendoAccount) {
		throw error(401, 'Authentication required.');
	}

	if (!(await hasSystemBotCapacity(locals.nintendoAccount))) {
		throw error(
			503,
			'All of our system users are full right now, so Discord linking is unavailable. Please try again later.'
		);
	}

	const { state, authoriseURL } = generateDiscordAuthURL();

	cookies.set('discord_auth_state', state, {
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		path: '/',
		maxAge: 300
	});

	return json({
		authoriseURL
	});
}
