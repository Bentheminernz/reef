import { error, fail, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCoralApi, invalidateCoralMedia } from '$lib/server/coral';

const handle: RequestHandler = async ({ locals, params }) => {
	if (!locals.nintendoAccount) {
		throw error(401, 'Authenticated required');
	}

	const coral = await getCoralApi(locals.nintendoAccount);

	try {
		await coral.deleteMedia(params.id);
	} catch (error) {
		console.log('Failed to delete media', error);
		throw fail(500, 'Failed to delete media');
	}

	invalidateCoralMedia(locals.nintendoAccount.id);

	return json({ success: true });
};

export const DELETE = handle;
export const POST = handle;
