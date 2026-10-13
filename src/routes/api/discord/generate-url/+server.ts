import { dev } from '$app/environment';
import { generateDiscordAuthURL } from '$lib/server/utils/DiscordAuth.js';
import { json } from '@sveltejs/kit';

export async function GET({ cookies }) {
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
