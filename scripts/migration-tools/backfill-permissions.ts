import '$lib/server/nxapi';
import { parseArgs } from 'node:util';
import { eq, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { nintendoAccount } from '$lib/server/db/schema';
import { getCoralApi } from '$lib/server/coral';

const CONCURRENCY = Math.max(1, Number(process.env.BACKFILL_CONCURRENCY ?? 4) || 4);

const { values } = parseArgs({
	options: {
		limit: { type: 'string' }
	}
});

const limit = values.limit == null ? undefined : Number(values.limit);

if (limit != null && (!Number.isInteger(limit) || limit <= 0)) {
	console.error('--limit must be a positive integer');
	process.exit(1);
}

async function forEachWithConcurrency<T>(
	items: T[],
	concurrency: number,
	task: (item: T) => Promise<void>
): Promise<void> {
	let next = 0;

	const worker = async () => {
		while (next < items.length) {
			await task(items[next++]);
		}
	};

	await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
}

const pending = await db
	.select()
	.from(nintendoAccount)
	.where(isNull(nintendoAccount.currentUserPermissions))
	.all();

const users = limit == null ? pending : pending.slice(0, limit);

console.log(
	limit == null
		? `Backfilling permissions for ${users.length} account(s) with ${CONCURRENCY} in flight.`
		: `Backfilling permissions for ${users.length}/${pending.length} account(s) (--limit ${limit}) with ${CONCURRENCY} in flight.`
);

let filled = 0;
let processed = 0;
const failures: { naId: string; error: string }[] = [];

await forEachWithConcurrency(users, CONCURRENCY, async (user) => {
	try {
		const coral = await getCoralApi(user);
		const permissions = await coral.getCurrentUserPermissions();

		await db
			.update(nintendoAccount)
			.set({ currentUserPermissions: permissions })
			.where(eq(nintendoAccount.id, user.id));

		console.log(`Filled user ${user.id}`);
		filled += 1;
	} catch (cause) {
		failures.push({
			naId: user.naId,
			error: cause instanceof Error ? cause.message : String(cause)
		});
	} finally {
		processed += 1;

		if (processed % 25 === 0) {
			console.log(`  ${processed}/${users.length} processed`);
		}
	}
});

console.log(`Done: ${filled} filled, ${failures.length} failed.`);

if (failures.length > 0) {
	console.log('Failed accounts (re-run the script to retry them):');

	for (const { naId, error } of failures) {
		console.log(`  - ${naId}: ${error}`);
	}

	process.exitCode = 1;
}
