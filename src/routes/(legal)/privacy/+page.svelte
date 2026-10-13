<script lang="ts">
	import PolicyDocument from '$lib/components/PolicyDocument.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<div class="mx-auto max-w-3xl">
	<PolicyDocument
		version={data.version}
		enforcementDate={data.enforcementDate}
		content={data.content}
	/>
</div>
