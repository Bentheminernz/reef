import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { retryBotFriendship } from '$lib/server/utils/NintendoAuth';

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.nintendoAccount) {
		throw error(401, 'Authentication required');
	}

	const status = await retryBotFriendship(locals.nintendoAccount.id);

	return json({ status });
};
