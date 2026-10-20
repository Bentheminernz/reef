import {
	verifyAuthenticationResponse,
	type AuthenticationResponseJSON
} from '@simplewebauthn/server';
import { error, json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { passkeys } from '$lib/server/db/schema';
import { createSession } from '$lib/server/session';
import {
	ensureFriendCode,
	ensureUserPermissions,
	retryBotFriendship
} from '$lib/server/utils/NintendoAuth';
import { getOrigin, getRPID } from '$lib/server/webauthn';

export async function POST({ request, cookies, url }) {
	const expectedChallenge = cookies.get('webauth_authentication_challenge');
	if (!expectedChallenge) error(400, 'Authentication challenge expired');
	cookies.delete('webauth_authentication_challenge', { path: '/' });

	const response = (await request.json()) as AuthenticationResponseJSON;
	const credential = await db.query.passkeys.findFirst({
		where: eq(passkeys.id, response.id)
	});
	if (!credential) error(401, 'Passkey not recognised');

	let verification;
	try {
		verification = await verifyAuthenticationResponse({
			response,
			expectedChallenge,
			expectedOrigin: getOrigin(url),
			expectedRPID: getRPID(url),
			credential: {
				id: credential.id,
				publicKey: new Uint8Array(credential.publicKey),
				counter: credential.counter,
				transports: credential.transports ?? undefined
			},
			requireUserVerification: true
		});
	} catch {
		error(401, 'Passkey authentication failed');
	}

	if (!verification.verified) error(401, 'Passkey authentication failed');

	await db
		.update(passkeys)
		.set({
			counter: verification.authenticationInfo.newCounter,
			backedUp: verification.authenticationInfo.credentialBackedUp
		})
		.where(eq(passkeys.id, credential.id));

	const jwt = await createSession(credential.nintendoAccountId);
	cookies.set('session', jwt, {
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		path: '/'
	});

	void ensureFriendCode(credential.nintendoAccountId);
	void ensureUserPermissions(credential.nintendoAccountId);

	void retryBotFriendship(credential.nintendoAccountId).catch((cause) =>
		console.error('Failed to repair system bot friendship', cause)
	);

	return json({ verified: true });
}
