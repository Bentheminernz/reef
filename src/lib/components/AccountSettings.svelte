<script lang="ts">
	import type { VisibleSystemBotInfo } from '$lib/types/settings';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Bot from '@lucide/svelte/icons/bot';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import DeleteAccountModal from './DeleteAccountModal.svelte';

	let {
		visibleSystemBotInfo
	}: {
		visibleSystemBotInfo?: VisibleSystemBotInfo | null;
	} = $props();

	let deleteModalOpen = $state(false);

	const webServiceLabels: Record<string, string> = {
		splatnet3: 'SplatNet 3'
	};
</script>

<section aria-labelledby="account-heading">
	<h2 id="account-heading" class="mb-3 text-lg font-semibold">Account</h2>

	<div class="overflow-hidden rounded-2xl border border-base-300 bg-base-200">
		<div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
			{#if visibleSystemBotInfo}
				<img
					src={visibleSystemBotInfo.imageUri}
					class="size-11 shrink-0 rounded-full"
					alt="{visibleSystemBotInfo.name}'s profile picture"
				/>
			{:else}
				<div class="grid size-11 shrink-0 place-items-center rounded-full bg-base-300">
					<Bot />
				</div>
			{/if}

			<div class="min-w-0 flex-1">
				<p class="font-semibold">
					{visibleSystemBotInfo?.name ?? 'No system bot assigned'}
				</p>
				<p class="text-sm opacity-65">Your assigned system bot, used to fetch your presence.</p>

				{#if visibleSystemBotInfo}
					<ul class="mt-1 space-y-0.5 text-sm opacity-50">
						{#each Object.entries(visibleSystemBotInfo.webServices) as [service, enabled] (service)}
							<li>
								{webServiceLabels[service] ?? service}: {enabled ? 'Available' : 'Unavailable'}
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>

		<div class="border-t border-base-300"></div>

		<div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
			<div class="grid size-11 shrink-0 place-items-center rounded-full bg-error/15 text-error">
				<LogOut />
			</div>

			<div class="min-w-0 flex-1">
				<p class="font-semibold">Sign out</p>
				<p class="mt-0.5 text-sm opacity-65">End this session on this device.</p>
			</div>

			<form method="POST" action="?/signOut">
				<button class="btn w-full btn-outline btn-error sm:w-auto" type="submit">Sign out</button>
			</form>
		</div>

		<div class="border-t border-base-300"></div>

		<div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
			<div class="grid size-11 shrink-0 place-items-center rounded-full bg-error/15 text-error">
				<Trash2 />
			</div>

			<div class="min-w-0 flex-1">
				<p class="font-semibold">Delete account</p>
				<p class="mt-0.5 text-sm opacity-65">
					Permanently delete your account and all linked data.
				</p>
			</div>

			<button
				class="btn w-full btn-outline btn-error sm:w-auto"
				type="button"
				onclick={() => (deleteModalOpen = true)}
			>
				Delete account
			</button>
		</div>
	</div>

	<DeleteAccountModal bind:open={deleteModalOpen} />
</section>
