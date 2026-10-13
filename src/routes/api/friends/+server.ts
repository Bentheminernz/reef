import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Friend_4 } from 'nxapi/coral';
import { getCoralApi, getCoralFriends } from '$lib/server/coral';

function lastOnline(friend: Friend_4): number {
	return friend.presence.state === 'OFFLINE' ? friend.presence.logoutAt : friend.presence.updatedAt;
}

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.nintendoAccount) {
		throw error(401, 'Authentication required');
	}

	const coral = await getCoralApi(locals.nintendoAccount);
	const friendList = await getCoralFriends(locals.nintendoAccount, coral);
	const friends = [...friendList.friends].sort((a, b) => lastOnline(a) - lastOnline(b));

	return json({ friends });
};
