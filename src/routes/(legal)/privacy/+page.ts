import type { PageLoad } from './$types';

export const load: PageLoad = ({ data }) => ({
	meta: {
		title: 'Privacy Policy · Reef',
		description: 'How Reef handles your data, Nintendo Account and Discord information.'
	},
	...data
});
