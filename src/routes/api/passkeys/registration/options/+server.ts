import { generateRegistrationOptions } from '@simplewebauthn/server';
import { getRPID, rpName } from '$lib/server/webauthn';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { eq } from 'drizzle-orm';
import { passkeys } from '$lib/server/db/schema.js';
import type { CoralAuthData } from 'nxapi/coral';
import { dev } from '$app/environment';

export async function POST({ locals, cookies, url }) {
	if (!locals.nintendoAccount) error(401, 'Authentication required');
	const account = locals.nintendoAccount;

	const existingCreds = await db.query.passkeys.findMany({
		where: eq(passkeys.nintendoAccountId, account.id)
	});

	let coral: CoralAuthData | undefined;
	if (account.coralAuthData) coral = account.coralAuthData;

	const options = await generateRegistrationOptions({
		rpName,
		rpID: getRPID(url),
		userName: coral?.nsoAccount?.user.name ?? account.naId,
		userID: new TextEncoder().encode(account.id),
		attestationType: 'none',
		excludeCredentials: existingCreds.map((credential) => ({
			id: credential.id,
			transports: credential.transports ?? undefined
		})),
		authenticatorSelection: {
			residentKey: 'required',
			userVerification: 'required'
		}
	});

	cookies.set('webauth_registration_challenge', options.challenge, {
		httpOnly: true,
		secure: !dev,
		sameSite: 'strict',
		path: '/',
		maxAge: 300
	});

	return json(options);
}
