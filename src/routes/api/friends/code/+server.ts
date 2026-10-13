import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCoralApi, getCoralFriendCode } from '$lib/server/coral';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.nintendoAccount) {
		throw error(401, 'Authentication required');
	}

	const coral = await getCoralApi(locals.nintendoAccount);
	const { friendCode, friendCodeURL } = await getCoralFriendCode(locals.nintendoAccount, coral);

	return json({ friendCode, friendCodeURL });
};
