import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { nintendoAccount } from '$lib/server/db/schema';

interface PermissionRule {
	values: readonly string[] | null;
}

const PERMISSIONS: Record<string, PermissionRule> = {
	'discord-username-search': { values: null }
};

interface PermissionRequest {
	type?: string;
	value?: unknown;
}

export const PUT: RequestHandler = async ({ locals, request }) => {
	if (!locals.nintendoAccount) {
		throw error(401, 'Authentication required');
	}

	const user = locals.nintendoAccount;
	const body = (await request.json().catch(() => ({}))) as PermissionRequest;
	const rule = PERMISSIONS[body.type ?? ''];

	if (rule == null) {
		console.error('Invalid Reef permission type (%s) for user %s', body.type, user.id);
		throw error(400, 'Invalid permission type');
	}

	const valid =
		rule.values == null
			? typeof body.value === 'boolean'
			: typeof body.value === 'string' && rule.values.includes(body.value);

	if (!valid) {
		console.error('Invalid Reef permission value (%s) for user %s', String(body.value), user.id);
		throw error(400, 'Invalid permission value');
	}

	try {
		switch (body.type) {
			case 'discord-username-search': {
				const allowDiscordUsernameSearching = body.value as boolean;

				await db
					.update(nintendoAccount)
					.set({ allowDiscordUsernameSearching })
					.where(eq(nintendoAccount.id, user.id));

				user.allowDiscordUsernameSearching = allowDiscordUsernameSearching;
				break;
			}
		}
	} catch (cause) {
		console.error('Reef permission update failed for user %s', user.id, cause);
		throw error(500, 'Could not update permission');
	}

	return json({
		success: true,
		userPermissions: {
			coral: user.currentUserPermissions,
			reef: {
				allowDiscordUsernameSearching: user.allowDiscordUsernameSearching
			}
		}
	});
};
