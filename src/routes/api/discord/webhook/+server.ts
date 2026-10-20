import nacl from 'tweetnacl';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { discordLinks, nintendoAccount, presenceSessions } from '$lib/server/db/schema';
import { removeBotFriendship } from '$lib/server/utils/NintendoAuth';
import { eq } from 'drizzle-orm';

const PUBLIC_KEY = process.env.DISCORD_CLIENT_PUBLIC_KEY;

if (!PUBLIC_KEY) {
	console.error('[discord-webhook] DISCORD_CLIENT_PUBLIC_KEY is not set; events will be rejected');
}

interface DiscordWebhookPayload {
	type: number;
	event?: {
		type: string;
		data: {
			user: { id: string };
		};
	};
}

function verifySignature(
	body: string,
	signature: string | null,
	timestamp: string | null
): boolean {
	if (!PUBLIC_KEY || !signature || !timestamp) return false;

	const sigBuf = Buffer.from(signature, 'hex');
	const keyBuf = Buffer.from(PUBLIC_KEY, 'hex');

	if (sigBuf.length !== 64 || keyBuf.length !== 32) return false;

	try {
		return nacl.sign.detached.verify(Buffer.from(timestamp + body), sigBuf, keyBuf);
	} catch {
		return false;
	}
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.text();

	if (
		!verifySignature(
			body,
			request.headers.get('x-signature-ed25519'),
			request.headers.get('x-signature-timestamp')
		)
	) {
		return new Response(null, { status: 401 });
	}

	let payload: DiscordWebhookPayload;

	try {
		payload = JSON.parse(body) as DiscordWebhookPayload;
	} catch {
		return new Response(null, { status: 400 });
	}

	if (payload.type === 0) {
		return new Response(null, { status: 204 });
	}

	if (payload.type === 1 && payload.event?.type === 'APPLICATION_DEAUTHORIZED') {
		const userId = payload.event.data.user.id;

		try {
			const link = await db
				.select({ id: discordLinks.id, nintendoAccountId: discordLinks.nintendoAccountId })
				.from(discordLinks)
				.where(eq(discordLinks.discordUserId, userId))
				.get();

			if (link != null) {
				const account = await db
					.select()
					.from(nintendoAccount)
					.where(eq(nintendoAccount.id, link.nintendoAccountId))
					.get();

				await db.transaction(async (tx) => {
					await tx.delete(presenceSessions).where(eq(presenceSessions.discordLinkId, link.id));
					await tx.delete(discordLinks).where(eq(discordLinks.id, link.id));
				});

				if (account != null) await removeBotFriendship(account);

				console.log(`[discord-webhook] Discord user ${userId} deauthorized; link removed`);
			}
		} catch (error) {
			console.error('[discord-webhook] Failed to handle APPLICATION_DEAUTHORIZED', error);

			return new Response(null, { status: 500 });
		}
	}

	return new Response(null, { status: 204 });
};
