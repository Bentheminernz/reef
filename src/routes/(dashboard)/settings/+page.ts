import type { PageLoad } from './$types';

export const load: PageLoad = () => ({
	meta: {
		title: 'Settings · Reef',
		description: 'Manage your Reef sign-in methods, Discord link and presence sharing.'
	}
});
