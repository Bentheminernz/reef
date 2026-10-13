import { lt } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { dataAccess } from '$lib/server/db/schema';

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function logDataAccess(nintendoAccountId: string, endpoint: string, ok: boolean) {
	return db.insert(dataAccess).values({
		nintendoAccountId,
		endpoint,
		ok
	});
}

export function pruneDataAccess() {
	return db.delete(dataAccess).where(lt(dataAccess.createdAt, new Date(Date.now() - RETENTION_MS)));
}
