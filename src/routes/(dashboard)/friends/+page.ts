import type { PageLoad } from './$types';

export const load: PageLoad = () => ({
	meta: {
		title: 'Friends · Reef',
		description: 'See who is online and find friends by friend code or Discord username on Reef.'
	}
});
