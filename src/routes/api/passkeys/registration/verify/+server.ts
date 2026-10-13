import { verifyRegistrationResponse, type RegistrationResponseJSON } from '@simplewebauthn/server';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { passkeys } from '$lib/server/db/schema';
import { getOrigin, getRPID } from '$lib/server/webauthn';

export async function POST({ request, locals, cookies, url }) {
	const account = locals.nintendoAccount;
	if (!account) error(401, 'Authentication required');

	const expectedChallenge = cookies.get('webauth_registration_challenge');
	if (!expectedChallenge) error(400, 'Registration challenge expired');
	cookies.delete('webauth_registration_challenge', { path: '/' });

	const response = (await request.json()) as RegistrationResponseJSON;
	let verification;

	try {
		verification = await verifyRegistrationResponse({
			response,
			expectedChallenge,
			expectedOrigin: getOrigin(url),
			expectedRPID: getRPID(url),
			requireUserVerification: true
		});
	} catch {
		error(400, 'Passkey registration failed');
	}

	if (!verification.verified || !verification.registrationInfo) {
		error(400, 'Passkey registration failed');
	}

	const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

	const result = await db
		.insert(passkeys)
		.values({
			id: credential.id,
			nintendoAccountId: account.id,
			publicKey: Buffer.from(credential.publicKey),
			counter: credential.counter,
			deviceType: credentialDeviceType,
			backedUp: credentialBackedUp,
			transports: credential.transports
		})
		.onConflictDoNothing();

	if (result.rowsAffected === 0) error(409, 'This passkey is already registered');

	return json({ verified: true });
}
