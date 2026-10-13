import { eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sessions } from '$lib/server/db/schema';
import { verifySession } from '$lib/server/session';
import {
	acceptPrivacyPolicy,
	getCurrentPrivacyPolicy,
	hasAcceptedPrivacyPolicy,
	renderPolicyMarkdown
} from '$lib/server/policy';
import type { Actions, PageServerLoad } from './$types';

function resolveRedirectTo(value: FormDataEntryValue | string | null) {
	return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
		? value
		: '/';
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.nintendoAccount) redirect(302, '/login');

	const redirectTo = resolveRedirectTo(url.searchParams.get('redirectTo'));
	const policy = await getCurrentPrivacyPolicy();

	if (policy == null || (await hasAcceptedPrivacyPolicy(locals.nintendoAccount.id, policy.id))) {
		redirect(302, redirectTo);
	}

	return {
		version: policy.version,
		enforcementDate: policy.enforcementDate,
		content: await renderPolicyMarkdown(policy.content),
		redirectTo
	};
};

export const actions: Actions = {
	accept: async ({ locals, request }) => {
		if (!locals.nintendoAccount) redirect(302, '/login');

		const formData = await request.formData();

		if (formData.get('agreed') !== 'true') {
			return fail(400, { message: 'Please confirm that you have read and agree to the policy.' });
		}

		const policy = await getCurrentPrivacyPolicy();
		if (policy != null) await acceptPrivacyPolicy(locals.nintendoAccount.id, policy.id);

		redirect(303, resolveRedirectTo(formData.get('redirectTo')));
	},
	decline: async ({ cookies }) => {
		const token = cookies.get('session');

		if (token) {
			const sessionId = await verifySession(token);
			if (sessionId) await db.delete(sessions).where(eq(sessions.id, sessionId));
		}

		cookies.delete('session', { path: '/' });
		redirect(303, '/login?declined=1');
	}
};
