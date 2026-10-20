import '$lib/server/nxapi';
import { parseArgs } from 'node:util';
import { eq, isNotNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { discordLinks, nintendoAccount, systemBotUser } from '$lib/server/db/schema';
import { getSystemBotCoralApi } from '$lib/server/coral';

const DEFAULT_CONCURRENCY = 4;

const { values } = parseArgs({
	options: {
		bot: { type: 'string', multiple: true },
		all: { type: 'boolean', default: false },
		apply: { type: 'boolean', default: false },
		'include-bots': { type: 'boolean', default: false },
		concurrency: { type: 'string' }
	}
});

if (!values.all && (values.bot == null || values.bot.length === 0)) {
	console.error(
		'Usage: npm run script scripts/prune-bot-friends.ts -- --bot <id|naId> [--bot <id|naId> ...] | --all [--apply]'
	);
	console.error(
		'Unfriends every friend whose nsaId is not in nintendo_accounts or has no Discord link. Dry run unless --apply.'
	);
	process.exit(1);
}

const concurrency = Math.max(
	1,
	Number(values.concurrency ?? DEFAULT_CONCURRENCY) || DEFAULT_CONCURRENCY
);

async function forEachWithConcurrency<T>(
	items: T[],
	limit: number,
	task: (item: T) => Promise<void>
): Promise<void> {
	let next = 0;

	const worker = async () => {
		while (next < items.length) {
			await task(items[next++]);
		}
	};

	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
}

const accountRows = await db
	.select({ nsaId: nintendoAccount.nsaId })
	.from(nintendoAccount)
	.innerJoin(discordLinks, eq(discordLinks.nintendoAccountId, nintendoAccount.id))
	.where(isNotNull(nintendoAccount.nsaId))
	.all();

const enrolledNsaIds = new Set(accountRows.map((row) => row.nsaId));

const allBots = await db.select().from(systemBotUser).all();

let bots = allBots;

if (!values.all) {
	const targets = new Set(values.bot);

	bots = allBots.filter((bot) => targets.has(bot.id) || targets.has(bot.naId));

	const unknown = [...targets].filter(
		(target) => !bots.some((bot) => bot.id === target || bot.naId === target)
	);

	if (unknown.length > 0) {
		console.error(`Unknown system bot(s): ${unknown.join(', ')}`);
		process.exit(1);
	}
}

if (bots.length === 0) {
	console.error('No system bots selected.');
	process.exit(1);
}

const botNsaIds = new Set(allBots.map((bot) => bot.nsaId));

console.log(
	`${enrolledNsaIds.size} Discord-enrolled nsaId(s) in the database, ${bots.length} system bot(s) selected.`
);

if (!values.apply) {
	console.log('Dry run: no friends will be removed. Pass --apply to make changes.\n');
}

let totalRemoved = 0;
let totalSkipped = 0;
let totalFailed = 0;

for (const bot of bots) {
	const coral = await getSystemBotCoralApi(bot.id);
	const friendList = await coral.getFriendList();
	const friends = friendList.friends;

	const orphans = friends.filter((friend) => !enrolledNsaIds.has(friend.nsaId));

	const includeBots = values['include-bots'] === true;

	const skippedBots = includeBots ? [] : orphans.filter((friend) => botNsaIds.has(friend.nsaId));

	const removable = includeBots
		? orphans
		: orphans.filter((friend) => !botNsaIds.has(friend.nsaId));

	console.log(
		`Bot ${bot.naId} (${bot.id}): ${friends.length} friend(s), ${orphans.length} not Discord-enrolled, ${removable.length} to remove.`
	);

	if (skippedBots.length > 0) {
		totalSkipped += skippedBots.length;
		console.log(
			`  Skipping ${skippedBots.length} friend(s) that are system bots (pass --include-bots to remove them).`
		);
	}

	if (removable.length === 0) {
		console.log('');
		continue;
	}

	if (!values.apply) {
		for (const friend of removable) {
			console.log(`  Would unfriend ${friend.nsaId} (${friend.name ?? 'unknown'})`);
		}
		console.log('');
		continue;
	}

	let removed = 0;

	await forEachWithConcurrency(removable, concurrency, async (friend) => {
		try {
			await coral.deleteFriend(friend.nsaId);
			removed += 1;
			console.log(`  Unfriended ${friend.nsaId} (${friend.name ?? 'unknown'})`);
		} catch (error) {
			totalFailed += 1;
			console.error(`  Failed to unfriend ${friend.nsaId} (${friend.name ?? 'unknown'}):`, error);
		}
	});

	totalRemoved += removed;

	const remaining = friends.length - removed;

	await db
		.update(systemBotUser)
		.set({ friendCount: remaining })
		.where(eq(systemBotUser.id, bot.id));

	console.log(`  Removed ${removed}/${removable.length}; friend_count set to ${remaining}.\n`);
}

console.log(
	`Done. Removed ${totalRemoved} friend(s), skipped ${totalSkipped}, failed ${totalFailed}.`
);
