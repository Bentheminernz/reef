import { NintendoAccountSessionAuthorisationCoral } from 'nxapi/coral';
import { ErrorResponse } from 'nxapi';
import {
	NintendoAccountSessionAuthorisationError,
	type NintendoAccountSessionToken
} from 'nxapi/nintendo-account';
import type { PageServerLoad, Actions } from './$types';
import {
	loginWithSessionToken,
	systemBotHasRoom,
} from '$lib/server/utils/NintendoAuth';
import { createSession } from '$lib/server/session';
import { dev } from '$app/environment';
import { redirect } from '@sveltejs/kit';
import { count, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { nintendoAccount, siteSetting, systemBotUser } from '$lib/server/db/schema';
import { failWith, ReefError } from '$lib/types/errors';

function parseRedirectLink(redirectUri: string): URLSearchParams | null {
	try {
		return new URLSearchParams(new URL(redirectUri).hash.substring(1));
	} catch {
		return null;
	}
}

function isExpectedLoginError(error: unknown): boolean {
	return (
		error instanceof TypeError ||
		error instanceof NintendoAccountSessionAuthorisationError ||
		error instanceof ErrorResponse
	);
}

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	setHeaders({ 'Cache-Control': 'private, no-store' });

	const authenticator = NintendoAccountSessionAuthorisationCoral.create();

	const siteSettings = await db
		.select({
			signUpEnabled: siteSetting.signUpEnabled,
			discordInvite: siteSetting.discordInviteLink
		})
		.from(siteSetting)
		.where(eq(siteSetting.id, 1))
		.get();

	const systemBots = await db
		.select({
			coralAuthData: systemBotUser.coralAuthData,
			friendCount: systemBotUser.friendCount,
			assignedAccounts: count(nintendoAccount.id)
		})
		.from(systemBotUser)
		.leftJoin(nintendoAccount, eq(nintendoAccount.systemBotUserId, systemBotUser.id))
		.groupBy(systemBotUser.id)
		.all();

	const availableSystemBots = systemBots
		.filter(systemBotHasRoom)
		.map((bot) => bot.coralAuthData?.nsoAccount.user.name)
		.filter((name): name is string => name != null);

	return {
		signUpEnabled: siteSettings!.signUpEnabled,
		discordInvite: siteSettings!.discordInvite,
		authoriseUrl: authenticator.authorise_url,
		state: authenticator.state,
		verifier: authenticator.verifier,
		declined: url.searchParams.has('declined'),
		availableSystemBots
	};
};

export const actions: Actions = {
	login: async ({ request, cookies }) => {
		const formData = await request.formData();
		const redirectUri = (formData.get('redirectUri') as string | null) ?? '';
		const authoriseUrl = formData.get('authoriseUrl') as string | null;
		const state = formData.get('state') as string | null;
		const verifier = formData.get('verifier') as string | null;

		const params = parseRedirectLink(redirectUri);

		if (!authoriseUrl || !state || !verifier) {
			return failWith('nintendo_link', { redirectUri });
		}

		if (!params) {
			return failWith('invalid_link', { redirectUri });
		}

		if (params.get('state') !== state) {
			return failWith('nintendo_link', { redirectUri });
		}

		let naSession: NintendoAccountSessionToken;

		try {
			const authenticator = NintendoAccountSessionAuthorisationCoral.resume(
				authoriseUrl,
				state,
				verifier
			);
			naSession = await authenticator.getSessionToken(params);
		} catch (error) {
			if (isExpectedLoginError(error)) {
				return failWith('nintendo_link', { redirectUri });
			}

			console.error('Nintendo sign-in exchange failed', error);
			return failWith('nintendo_link', { redirectUri });
		}

		try {
			const { account } = await loginWithSessionToken(naSession.session_token, naSession.code);
			const jwt = await createSession(account.id);

			cookies.set('session', jwt, {
				httpOnly: true,
				secure: !dev,
				sameSite: 'lax',
				path: '/'
			});
		} catch (error) {
			if (error instanceof ReefError) {
				return failWith(error.code, { redirectUri });
			}

			console.error('Nintendo sign-in failed', error);
			return failWith('nintendo_link', { redirectUri });
		}

		return redirect(302, '/');
	}
};
