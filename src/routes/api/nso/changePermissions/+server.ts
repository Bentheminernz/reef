import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import type { CurrentUserPermissions, PlayLogPermissions, PresencePermissions } from 'nxapi/coral';
import { db } from '$lib/server/db';
import { nintendoAccount } from '$lib/server/db/schema';
import { getCoralApi } from '$lib/server/coral';

interface PermissionRule {
	values: readonly string[] | null;
}

const PERMISSIONS: Record<string, PermissionRule> = {
	presence: { values: ['FRIENDS', 'FAVORITE_FRIENDS', 'SELF'] },
	'play-log': { values: ['EVERYONE', 'FRIENDS', 'FAVORITE_FRIENDS', 'SELF'] },
	'friend-request': { values: null }
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
		console.error('Invalid permission type (%s) for user %s', body.type, user.id);
		throw error(400, 'Invalid permission type');
	}

	const valid =
		rule.values == null
			? typeof body.value === 'boolean'
			: typeof body.value === 'string' && rule.values.includes(body.value);

	if (!valid) {
		console.error('Invalid permission value (%s) for user %s', String(body.value), user.id);
		throw error(400, 'Invalid permission value');
	}

	const coral = await getCoralApi(user);

	try {
		switch (body.type) {
			case 'presence':
				await coral.updateUserPresencePermissions(body.value as PresencePermissions);
				break;
			case 'play-log':
				await coral.updateUserPlayLogPermissions(body.value as PlayLogPermissions);
				break;
			case 'friend-request':
				await coral.updateUserFriendRequestPermissions(body.value as boolean);
				break;
		}
	} catch (cause) {
		console.error('Permission update failed for user %s', user.id, cause);
		throw error(502, 'Could not update permission');
	}

	let userPermissions: CurrentUserPermissions | null = null;

	try {
		const permissions = await coral.getCurrentUserPermissions();

		await db
			.update(nintendoAccount)
			.set({ currentUserPermissions: permissions, permissionsSyncedAt: new Date() })
			.where(eq(nintendoAccount.id, user.id));

		user.currentUserPermissions = permissions;
		user.permissionsSyncedAt = new Date();
		userPermissions = permissions;
	} catch (cause) {
		console.error('Failed to persist permissions for user %s', user.id, cause);
	}

	return json({ success: true, userPermissions });
};
