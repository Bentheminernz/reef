import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCoralApi } from '$lib/server/coral';

const NSA_ID = /^[0-9a-f]{16}$/i;

export const POST: RequestHandler = async ({ locals, params }) => {
	if (!locals.nintendoAccount) {
		throw error(401, 'Authentication required');
	}

	if (!NSA_ID.test(params.nsaId)) {
		throw error(400, 'Invalid friend ID');
	}

	const coral = await getCoralApi(locals.nintendoAccount);

	try {
		await coral.sendFriendRequest(params.nsaId);
	} catch (cause) {
		console.error('Friend request failed', cause);
		throw error(400, 'Could not send the friend request');
	}

	return json({ sent: true });
};
