import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCoralApi } from '$lib/server/coral';

const NSA_ID = /^[0-9a-f]{16}$/i;

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.nintendoAccount) {
		throw error(401, 'Authentication required');
	}

	if (!NSA_ID.test(params.nsaId)) {
		throw error(400, 'Invalid friend ID');
	}

	const body = (await request.json().catch(() => ({}))) as { favourite?: unknown };

	if (typeof body.favourite !== 'boolean') {
		throw error(400, 'Expected a favourite flag');
	}

	const coral = await getCoralApi(locals.nintendoAccount);

	try {
		if (body.favourite) {
			await coral.addFavouriteFriend(params.nsaId);
		} else {
			await coral.removeFavouriteFriend(params.nsaId);
		}
	} catch (cause) {
		console.error('Friend favourite update failed', cause);
		throw error(400, 'Could not update favourite');
	}

	const friend = await coral.getFriend(params.nsaId);

	return json({ success: true, friend });
};
