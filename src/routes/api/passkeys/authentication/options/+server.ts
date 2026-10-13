import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { getRPID } from '$lib/server/webauthn';

export async function POST({ cookies, url }) {
	const options = await generateAuthenticationOptions({
		rpID: getRPID(url),
		userVerification: 'required'
	});

	cookies.set('webauth_authentication_challenge', options.challenge, {
		httpOnly: true,
		secure: !dev,
		sameSite: 'strict',
		path: '/',
		maxAge: 300
	});

	return json(options);
}
