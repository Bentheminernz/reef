import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import CoralApi, { NintendoAccountSessionAuthorisationCoral } from 'nxapi/coral';
import { db } from '$lib/server/db';
import { systemBotUser } from '$lib/server/db/schema';
import { addUserAgent } from 'nxapi';
import { parseArgs } from 'node:util';
import SplatNet3Api from 'nxapi/splatnet3';
import pkg from '../package.json';

addUserAgent(`benlawrenceReef/${pkg.version} (+ben@reefpresence.app)`);

function getSubFromSessionToken(sessionToken: string): string {
	const payload = sessionToken.split('.')[1];
	const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
	return decoded.sub;
}

const rl = createInterface({ input, output });

const { values } = parseArgs({
	options: {
		'enable-splatnet3': { type: 'boolean', default: false }
	}
});

const authenticator = NintendoAccountSessionAuthorisationCoral.create();

console.log(authenticator.authorise_url);
const redirectURI = await rl.question('Redirect URI? ');

const naSession = await authenticator.getSessionToken(
	new URLSearchParams(new URL(redirectURI).hash.substring(1))
);

const naId = getSubFromSessionToken(naSession.session_token);
const { nso, data } = await CoralApi.createWithSessionToken(naSession.session_token);

if (!values['enable-splatnet3']) {
	await db
		.insert(systemBotUser)
		.values({
			naId: naId,
			nsaId: data.nsoAccount.user.nsaId,
			nintendoAccountSession: naSession,
			coralAuthData: data,
			allowingRequests: true
		})
		.onConflictDoUpdate({
			target: systemBotUser.naId,
			set: {
				nsaId: data.nsoAccount.user.nsaId,
				nintendoAccountSession: naSession,
				coralAuthData: data
			}
		});
} else {
	const { data: splatnetData } = await SplatNet3Api.createWithCoral(nso, data.user);

	await db
		.insert(systemBotUser)
		.values({
			naId: naId,
			nsaId: data.nsoAccount.user.nsaId,
			nintendoAccountSession: naSession,
			coralAuthData: data,
			allowingRequests: true,
			splatnet3Enabled: true,
			splatnet3AuthData: splatnetData
		})
		.onConflictDoUpdate({
			target: systemBotUser.naId,
			set: {
				nsaId: data.nsoAccount.user.nsaId,
				nintendoAccountSession: naSession,
				coralAuthData: data,
				splatnet3Enabled: true,
				splatnet3AuthData: splatnetData
			}
		});
}

console.log('success');
process.exit(0);
