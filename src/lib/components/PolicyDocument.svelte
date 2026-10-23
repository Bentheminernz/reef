<script lang="ts">
	import { m } from "$lib/paraglide/messages";

	let {
		version,
		enforcementDate,
		content
	}: { version: string; enforcementDate: Date; content: string } = $props();

	function formatDate(value: Date) {
		return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(value);
	}
</script>

<article class="prose max-w-none">
	<h1>{m.common_privacy_policy()}</h1>
	<p>{m.updated_privacy_policy_document_subtitle({ version, date: formatDate(enforcementDate)})}</p>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized in $lib/server/policy.ts -->
	{@html content}
</article>
