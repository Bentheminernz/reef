<script lang="ts">
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
	<h1>Privacy Policy</h1>
	<p>Version {version} &middot; Effective {formatDate(enforcementDate)}</p>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized in $lib/server/policy.ts -->
	{@html content}
</article>
