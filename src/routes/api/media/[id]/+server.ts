import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCoralApi, getCoralMedia } from '$lib/server/coral';

export const GET: RequestHandler = async ({ fetch, locals, params }) => {
	if (!locals.nintendoAccount) {
		throw error(401, 'Authentication required');
	}

	const coral = await getCoralApi(locals.nintendoAccount);
	const media = await getCoralMedia(locals.nintendoAccount, coral);
	const item = media.media.find((candidate) => candidate.id === params.id);

	if (!item) {
		throw error(404, 'Media item not found');
	}

	const upstream = await fetch(item.contentUri);

	if (!upstream.ok) {
		throw error(502, 'Unable to download media');
	}

	const extension = item.type === 'video' ? 'mp4' : 'jpg';
	const name = (item.appName || 'album-item').replace(/[^a-zA-Z0-9._-]+/g, '-');
	const filename = `${name}-${item.id}.${extension}`;
	const headers = new Headers({
		'Cache-Control': 'private, no-store',
		'Content-Disposition': `attachment; filename="${filename}"`,
		'Content-Type': upstream.headers.get('Content-Type') ?? 'application/octet-stream'
	});
	const contentLength = upstream.headers.get('Content-Length');

	if (contentLength) {
		headers.set('Content-Length', contentLength);
	}

	return new Response(upstream.body, { headers });
};
