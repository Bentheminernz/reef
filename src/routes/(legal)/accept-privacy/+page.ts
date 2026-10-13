import type { PageLoad } from './$types';

export const load: PageLoad = ({ data }) => ({
	meta: {
		title: 'Accept Privacy Policy · Reef',
		description: 'Accept the Reef privacy policy to continue using Reef.'
	},
	...data
});
