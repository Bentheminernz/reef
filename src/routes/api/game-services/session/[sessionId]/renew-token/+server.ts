import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGameWebServiceToken } from '$lib/server/coral';
import { getGameWebviewSession } from '$lib/server/game-webview';

export const POST: RequestHandler = async ({ locals, params, request, url }) => {
	if (!locals.nintendoAccount) throw error(401, 'Authentication required');
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) throw error(403, 'Cross-origin request denied');

	const session = await getGameWebviewSession(locals.nintendoAccount.id, params.sessionId);
	if (!session) throw error(404, 'Game-service session not found');

	const token = await getGameWebServiceToken(locals.nintendoAccount, session.serviceId, true);
	return json(
		{ token: token.token, expiresAt: token.expiresAt },
		{ headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } }
	);
};
