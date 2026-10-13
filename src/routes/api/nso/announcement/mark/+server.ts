import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clearNotificationsCache, getCoralApi } from '$lib/server/coral';

export const PUT: RequestHandler = async ({ locals, request }) => {
	if (!locals.nintendoAccount) {
		throw error(401, 'Authentication required');
	}

	const body = await request.json();
	if (!body.id) {
		throw error(400, 'No Announcement id found.');
	}

	const coral = await getCoralApi(locals.nintendoAccount);

	try {
		await coral.setAnnouncementRead(body.id);
		clearNotificationsCache(locals.nintendoAccount.id);
	} catch (cause) {
		console.error('Failed to read announcement', cause);
		throw error(500, 'Failed to read announcement');
	}

	return json({
		success: true
	});
};

export const DELETE = PUT;
