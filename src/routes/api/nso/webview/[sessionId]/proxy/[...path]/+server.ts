import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { proxyGameWebviewRequest } from '$lib/server/game-webview';

const handle: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.nintendoAccount) throw error(401, 'Authentication required');
	return proxyGameWebviewRequest(
		request,
		locals.nintendoAccount.id,
		params.sessionId,
		params.path || ''
	);
};

export const GET = handle;
export const HEAD = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
