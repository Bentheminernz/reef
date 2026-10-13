import type { PageLoad } from './$types';

export const load: PageLoad = ({ data }) => ({
	meta: {
		title: 'Sign in · Reef',
		description:
			'Sign in with a passkey or Nintendo Account to share your Switch presence on Discord.'
	},
	...data
});
