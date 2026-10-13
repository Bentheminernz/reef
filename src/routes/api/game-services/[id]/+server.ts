import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCoralApi, getCoralWebServices, getGameWebServiceToken } from '$lib/server/coral';
import { createGameWebviewSession } from '$lib/server/game-webview';

const SERVICE_ID = /^\d{1,16}$/;

export const POST: RequestHandler = async ({ locals, params, request, url }) => {
	if (!locals.nintendoAccount) throw error(401, 'Authentication required');

	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) throw error(403, 'Cross-origin launch denied');
	if (!SERVICE_ID.test(params.id)) throw error(400, 'Invalid game service ID');

	const serviceId = Number(params.id);
	if (!Number.isSafeInteger(serviceId)) throw error(400, 'Invalid game service ID');

	const requestBody = (await request.json().catch(() => ({}))) as { forceFresh?: boolean };
	const coral = await getCoralApi(locals.nintendoAccount);
	const services = await getCoralWebServices(locals.nintendoAccount, coral);
	const service = services.find((item) => item.id === serviceId);

	if (!service) throw error(404, 'Game service is not available for this account');

	try {
		await getGameWebServiceToken(
			locals.nintendoAccount,
			serviceId,
			requestBody.forceFresh === true
		);
		const user = locals.nintendoAccount.coralAuthData?.user;
		const response = await createGameWebviewSession(
			locals.nintendoAccount.id,
			service,
			user?.language || 'en-GB',
			user?.country || 'GB'
		);

		return json(response, {
			headers: {
				'Cache-Control': 'private, no-store',
				'Referrer-Policy': 'no-referrer'
			}
		});
	} catch (cause) {
		const upstream = cause as {
			response?: {
				status?: number;
				statusText?: string;
				headers?: { get?: (name: string) => string | null };
			};
			data?: { error?: string; error_message?: string; error_description?: string };
		};
		const upstreamStatus = Number(upstream.response?.status || 0);
		const retryAfter = upstream.response?.headers?.get?.('retry-after');
		console.error('[GameServiceLaunch] Token generation failed', {
			serviceId,
			error: cause instanceof Error ? cause.message : String(cause),
			upstreamStatus: upstreamStatus || undefined,
			upstreamStatusText: upstream.response?.statusText,
			providerError:
				upstream.data?.error_message || upstream.data?.error_description || upstream.data?.error
		});
		const status = upstreamStatus === 429 ? 429 : 502;
		const headers: Record<string, string> = { 'Cache-Control': 'private, no-store' };
		if (retryAfter) headers['Retry-After'] = retryAfter;
		return json(
			{
				message:
					status === 429
						? 'The nxapi service is rate-limited. Please wait before trying again.'
						: 'Nintendo could not start this game service.'
			},
			{ status, headers }
		);
	}
};
