<script lang="ts">
	import { invalidate } from '$app/navigation';
	import Info from '@lucide/svelte/icons/info';
	import Newspaper from '@lucide/svelte/icons/newspaper';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Wrench from '@lucide/svelte/icons/wrench';
	import type { CoralSvelteNotice } from '$lib/types/notifications';

	let { notice }: { notice: CoralSvelteNotice } = $props();

	const categoryIcon: Record<CoralSvelteNotice['category'], typeof Info> = {
		News: Newspaper,
		Update: RefreshCw,
		Maintenance: Wrench,
		Other: Info
	};

	let acknowledging = $state(false);
	let actionError = $state('');

	const NoticeIcon = $derived(categoryIcon[notice.category]);

	// Lock page scroll while the modal (blocking overlay) is open.
	$effect(() => {
		const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previous;
		};
	});

	async function acknowledge() {
		if (acknowledging) return;

		acknowledging = true;
		actionError = '';

		try {
			const response = await fetch(`/api/notices/${notice.id}/acknowledge`, { method: 'PUT' });

			if (!response.ok) {
				throw new Error('Could not acknowledge the notice');
			}

			await invalidate('app:notices');
		} catch (cause) {
			actionError = cause instanceof Error ? cause.message : 'Could not acknowledge the notice';
		} finally {
			acknowledging = false;
		}
	}
</script>

<div
	class="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
	role="dialog"
	aria-modal="true"
	aria-labelledby="required-notice-title"
>
	<div
		class="flex max-h-full w-full max-w-lg flex-col gap-4 overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-xl"
	>
		<header class="flex flex-col gap-2 px-5 pt-5">
			<div class="flex items-center gap-3">
				<div class="grid size-11 shrink-0 place-items-center rounded-full bg-base-300">
					<NoticeIcon class="size-6 text-base-content/70" aria-hidden="true" />
				</div>
				<div>
					<h2 id="required-notice-title" class="text-lg font-bold">{notice.title}</h2>
					<p class="text-xs opacity-65">{notice.category}</p>
				</div>
			</div>
		</header>

		<div class="prose min-h-0 max-w-none flex-1 overflow-y-auto px-5">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized in $lib/server/markdown.ts -->
			{@html notice.contentHtml}
		</div>

		<footer class="flex flex-col gap-2 border-t border-base-300 px-5 py-4">
			{#if actionError}
				<p class="text-sm text-error" aria-live="polite">{actionError}</p>
			{/if}

			<button
				class="btn w-full btn-primary"
				type="button"
				onclick={acknowledge}
				disabled={acknowledging}
			>
				{acknowledging ? 'Acknowledging…' : 'Acknowledge'}
			</button>
		</footer>
	</div>
</div>
