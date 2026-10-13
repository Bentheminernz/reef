import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clearNotificationsCache, getCoralApi } from '$lib/server/coral';

const FRIEND_REQUEST_ID = /^[0-9a-f]{16}$/i;

export const PUT: RequestHandler = async ({ locals, params }) => {
	if (!locals.nintendoAccount) {
		throw error(401, 'Authentication required');
	}

	if (!FRIEND_REQUEST_ID.test(params.friendRequestId)) {
		throw error(400, 'Invalid friend request ID');
	}

	const coral = await getCoralApi(locals.nintendoAccount);

	try {
		await coral.setReceivedFriendRequestRead(params.friendRequestId);
		clearNotificationsCache(locals.nintendoAccount.id);
	} catch (cause) {
		console.error('Friend request mark-read failed', cause);
		throw error(400, 'Could not mark the friend request as read');
	}

	return json({ success: true });
};
