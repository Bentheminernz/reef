import { error, json } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { env } from '$env/dynamic/private';
import sharp from 'sharp';

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST({ request, locals }) {
	if (!locals.isAdmin) error(403, 'Forbidden');
	if (!env.UPLOAD_PATH) error(500, 'UPLOAD_PATH is not set');

	const form = await request.formData();
	const file = form.get('file');
	if (!(file instanceof File)) error(400, 'No file');
	if (file.size > MAX_BYTES) error(413, 'File too large');

	let output: Buffer;
	try {
		output = await sharp(Buffer.from(await file.arrayBuffer()))
			.rotate()
			.resize({ width: 1600, withoutEnlargement: true })
			.webp({ quality: 85 })
			.toBuffer();
	} catch {
		error(415, 'Not a valid image');
	}

	const name = `${randomUUID()}.webp`;
	await mkdir(env.UPLOAD_PATH, { recursive: true });
	await writeFile(join(env.UPLOAD_PATH, name), output);

	return json({ url: `/uploads/${name}` });
}
