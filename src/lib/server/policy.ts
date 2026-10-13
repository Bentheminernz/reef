import { and, desc, eq, lte } from 'drizzle-orm';
import { renderMarkdown } from '$lib/server/markdown';
import { db } from '$lib/server/db';
import { policyAcceptance, privacyPolicy } from '$lib/server/db/schema';

export async function getCurrentPrivacyPolicy() {
	return db
		.select()
		.from(privacyPolicy)
		.where(lte(privacyPolicy.enforcementDate, new Date()))
		.orderBy(desc(privacyPolicy.enforcementDate))
		.limit(1)
		.get();
}

export async function hasAcceptedPrivacyPolicy(nintendoAccountId: string, policyId: string) {
	const acceptance = await db
		.select({ policyId: policyAcceptance.policyId })
		.from(policyAcceptance)
		.where(
			and(
				eq(policyAcceptance.nintendoAccountId, nintendoAccountId),
				eq(policyAcceptance.policyId, policyId)
			)
		)
		.get();

	return acceptance != null;
}

export async function acceptPrivacyPolicy(nintendoAccountId: string, policyId: string) {
	await db.insert(policyAcceptance).values({ nintendoAccountId, policyId }).onConflictDoNothing();
}

export function renderPolicyMarkdown(content: string) {
	return renderMarkdown(content);
}
