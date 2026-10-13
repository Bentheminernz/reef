import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { acknowledgedNotice, notice } from '$lib/server/db/schema';

export const PUT: RequestHandler = async ({ locals, params }) => {
	if (!locals.nintendoAccount) {
		throw error(401, 'Authentication required');
	}

	const exists = await db
		.select({ id: notice.id })
		.from(notice)
		.where(eq(notice.id, params.id))
		.get();
	if (!exists) {
		throw error(404, 'Notice not found');
	}

	await db
		.insert(acknowledgedNotice)
		.values({
			nintendoAccountId: locals.nintendoAccount.id,
			noticeId: params.id,
			readAt: new Date()
		})
		.onConflictDoNothing();

	return json({ success: true });
};
