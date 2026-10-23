import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCoralApi, invalidateCoralFriends } from '$lib/server/coral';
import { httpError } from '$lib/types/errors';

const NSA_ID = /^[0-9a-f]{16}$/i;

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.nintendoAccount) throw httpError('authentication_required');
	if (!NSA_ID.test(params.nsaId)) throw httpError('invalid_request');

	try {
		const coral = await getCoralApi(locals.nintendoAccount);
		const [friend, playLog] = await Promise.all([
			coral.getFriend(params.nsaId),
			coral.getPlayLog(params.nsaId)
		]);

		return json({ friend, playLog });
	} catch (err) {
		console.error('Coral request failed', err);
		throw httpError('znca_error');
	}
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
    if (!locals.nintendoAccount) throw httpError('authentication_required');
	if (!NSA_ID.test(params.nsaId)) throw httpError('invalid_request');

	try {
	    const coral = await getCoralApi(locals.nintendoAccount);
        await coral.deleteFriend(params.nsaId);
        invalidateCoralFriends(locals.nintendoAccount.id);

        return new Response(null, { status: 204 });
    } catch (err) {
        console.error('Unfriending failed', err);
        throw httpError('znca_error')
	}
};
