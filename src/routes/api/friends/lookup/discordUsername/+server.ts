import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { discordLinks, nintendoAccount } from '$lib/server/db/schema';
import { getCoralApi, getCoralFriends, getSystemBotCoralApi } from '$lib/server/coral';
import type { FriendCodeUser, Friend_4 } from 'nxapi/coral';

function toCodeUser(friend: Friend_4): FriendCodeUser {
	return {
		id: friend.id,
		nsaId: friend.nsaId,
		imageUri: friend.imageUri,
		image2Uri: friend.image2Uri,
		name: friend.name,
		isBlocking: false,
		extras: {}
	};
}

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.nintendoAccount) {
		throw error(401, 'Authentication required');
	}

	const discordUsername = url.searchParams.get('username') ?? '';
	const username = discordUsername.trim();

	if (!username) {
		throw error(400, 'Enter a Discord username');
	}

	const [link] = await db
		.select({
			nsaId: nintendoAccount.nsaId,
			systemBotUserId: nintendoAccount.systemBotUserId
		})
		.from(discordLinks)
		.innerJoin(nintendoAccount, eq(discordLinks.nintendoAccountId, nintendoAccount.id))
		.where(sql`lower(${discordLinks.discordUsername}) = ${username.toLowerCase()}`)
		.limit(1);

	if (link?.nsaId == null) {
		throw error(404, 'No Nintendo Account found with that Discord username');
	}

	const coral = await getCoralApi(locals.nintendoAccount);

	let user: FriendCodeUser | null = null;
	let isFriend = false;

	try {
		const friends = await getCoralFriends(locals.nintendoAccount, coral);
		const friend = friends.friends.find((friend) => friend.nsaId === link.nsaId);
		if (friend) {
			isFriend = true;
			user = toCodeUser(friend);
		}
	} catch {
		// friend list only used to label
	}

	if (user == null && link.systemBotUserId != null) {
		try {
			const botCoral = await getSystemBotCoralApi(link.systemBotUserId);
			const botFriends = await botCoral.getFriendList();
			const friend = botFriends.friends.find((friend) => friend.nsaId === link.nsaId);
			if (friend) user = toCodeUser(friend);
		} catch (cause) {
			console.error('Discord username profile lookup failed', cause);
		}
	}

	if (user == null) {
		throw error(404, 'Could not find that account on Nintendo');
	}

	return json({
		user,
		isFriend,
		isSelf: link.nsaId === locals.nintendoAccount.nsaId
	});
};
