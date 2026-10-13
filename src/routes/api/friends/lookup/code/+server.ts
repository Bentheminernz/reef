import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCoralApi, getCoralFriends } from '$lib/server/coral';

const FRIEND_CODE = /^\d{4}-\d{4}-\d{4}$/;

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.nintendoAccount) {
		throw error(401, 'Authentication required');
	}

	const friendCode = url.searchParams.get('code') ?? '';

	if (!FRIEND_CODE.test(friendCode)) {
		throw error(400, 'Enter a valid friend code');
	}

	const coral = await getCoralApi(locals.nintendoAccount);

	let user;
	try {
		user = await coral.getUserByFriendCode(friendCode);
	} catch (cause) {
		console.error('Friend code lookup failed', cause);
		throw error(404, 'No Nintendo Account found with that friend code');
	}

	let isFriend = false;
	try {
		const friends = await getCoralFriends(locals.nintendoAccount, coral);
		isFriend = friends.friends.some((friend) => friend.nsaId === user.nsaId);
	} catch {
		// friend list only used to label
	}

	return json({
		user,
		isFriend,
		isSelf: user.nsaId === locals.nintendoAccount.nsaId
	});
};
