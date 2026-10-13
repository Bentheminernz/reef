import { error } from '@sveltejs/kit';
import { getCurrentPrivacyPolicy, renderPolicyMarkdown } from '$lib/server/policy';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const policy = await getCurrentPrivacyPolicy();

	if (policy == null) error(404, 'No privacy policy is currently in effect');

	return {
		version: policy.version,
		enforcementDate: policy.enforcementDate,
		content: await renderPolicyMarkdown(policy.content)
	};
};
