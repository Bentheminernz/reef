import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { closeGameWebviewSession } from '$lib/server/game-webview';

export const DELETE: RequestHandler = async ({ locals, params, request, url }) => {
	if (!locals.nintendoAccount) throw error(401, 'Authentication required');
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) throw error(403, 'Cross-origin request denied');

	await closeGameWebviewSession(locals.nintendoAccount.id, params.sessionId);
	return json({ success: true }, { headers: { 'Cache-Control': 'private, no-store' } });
};
