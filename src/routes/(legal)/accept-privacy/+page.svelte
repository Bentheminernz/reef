<script lang="ts">
	import PolicyDocument from '$lib/components/PolicyDocument.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let agreed = $state(false);
</script>

<div class="mx-auto flex max-w-3xl flex-col gap-4">
	<header class="flex flex-col gap-1">
		<h1 class="text-2xl font-bold">Updated Privacy Policy</h1>
		<p class="text-sm opacity-65">
			Please review and accept the Privacy Policy to continue using Reef.
		</p>
	</header>

	<div class="overflow-hidden rounded-2xl border border-base-300 bg-base-200">
		<div class="max-h-[55vh] overflow-y-auto bg-base-100 px-6 py-5">
			<PolicyDocument
				version={data.version}
				enforcementDate={data.enforcementDate}
				content={data.content}
			/>
		</div>

		<form method="POST" class="border-t border-base-300 px-5 py-4">
			<input type="hidden" name="redirectTo" value={data.redirectTo} />

			<label class="flex cursor-pointer items-start gap-3">
				<input
					type="checkbox"
					name="agreed"
					value="true"
					class="checkbox mt-0.5 checkbox-primary"
					bind:checked={agreed}
				/>
				<span class="text-sm">
					I have read and agree to the Privacy Policy, version {data.version}.
				</span>
			</label>

			{#if form?.message}
				<p class="mt-3 text-sm text-error" aria-live="polite">{form.message}</p>
			{/if}

			<div class="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
				<button class="btn btn-ghost" type="submit" formaction="?/decline">
					Decline and sign out
				</button>
				<button class="btn btn-primary" type="submit" formaction="?/accept" disabled={!agreed}>
					Accept and continue
				</button>
			</div>
		</form>
	</div>
</div>
