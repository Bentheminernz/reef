import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { env } from '$env/dynamic/private';

export async function GET({ params }) {
	if (!/^[0-9a-f-]{36}\.webp$/.test(params.file)) error(404);
	if (!env.UPLOAD_PATH) error(404);

	try {
		const data = await readFile(join(env.UPLOAD_PATH, params.file));
		return new Response(new Uint8Array(data), {
			headers: {
				'Content-Type': 'image/webp',
				'Cache-Control': 'public, max-age=31536000, immutable'
			}
		});
	} catch {
		error(404);
	}
}
