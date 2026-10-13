import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';

export const rpName = env.WEBAUTHN_RP_NAME ?? 'Reef';

export function getRPID(url: URL) {
	return dev ? url.hostname : (env.WEBAUTHN_RP_ID ?? url.hostname);
}

export function getOrigin(url: URL) {
	return dev ? url.origin : (env.WEBAUTHN_ORIGIN ?? url.origin);
}
