import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCoralApi, invalidateCoralFriends } from '$lib/server/coral';

const NSA_ID = /^[0-9a-f]{16}$/i;

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.nintendoAccount) {
		throw error(401, 'Authentication required');
	}

	if (!NSA_ID.test(params.nsaId)) {
		throw error(400, 'Invalid friend ID');
	}

	const coral = await getCoralApi(locals.nintendoAccount);
	const [friend, playLog] = await Promise.all([
		coral.getFriend(params.nsaId),
		coral.getPlayLog(params.nsaId)
	]);

	return json({ friend, playLog });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.nintendoAccount) {
		throw error(401, 'Authentication required');
	}

	if (!NSA_ID.test(params.nsaId)) {
		throw error(400, 'Invalid friend ID');
	}

	const coral = await getCoralApi(locals.nintendoAccount);
	await coral.deleteFriend(params.nsaId);
	invalidateCoralFriends(locals.nintendoAccount.id);

	return new Response(null, { status: 204 });
};
