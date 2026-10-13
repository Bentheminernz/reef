<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Media } from 'nxapi/coral';

	let {
		item,
		open = $bindable(false)
	}: {
		item: Media | undefined;
		open?: boolean;
	} = $props();

	let dialog = $state<HTMLDialogElement>();
	let confirmDelete = $state(false);
	let deletePending = $state(false);
	let deleteError = $state('');

	$effect(() => {
		if (open && !dialog?.open) {
			dialog?.showModal();
		} else if (!open && dialog?.open) {
			dialog.close();
		}
	});

	$effect(() => {
		if (open) {
			confirmDelete = false;
			deleteError = '';
		}
	});

	async function deleteItem() {
		if (!item || deletePending) return;

		deletePending = true;
		deleteError = '';

		try {
			const response = await fetch(resolve(`/api/media/${encodeURIComponent(item.id)}/delete`), {
				method: 'DELETE'
			});

			if (!response.ok) {
				throw new Error(await responseMessage(response, 'Could not delete media'));
			}

			open = false;
			await invalidate('app:media');
		} catch (error) {
			deleteError = error instanceof Error ? error.message : 'Could not delete media';
		} finally {
			deletePending = false;
		}
	}

	async function responseMessage(response: Response, fallback: string) {
		const body = (await response.json().catch(() => null)) as {
			message?: string;
			data?: string;
		} | null;
		return body?.message ?? body?.data ?? fallback;
	}

	function formatDateTime(unixSeconds: number): string {
		const date = new Date(unixSeconds * 1000);
		const day = String(date.getDate()).padStart(2, '0');
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const year = date.getFullYear();
		let hours = date.getHours();
		const minutes = String(date.getMinutes()).padStart(2, '0');
		const ampm = hours >= 12 ? 'pm' : 'am';
		hours = hours % 12 || 12;
		return `${day}/${month}/${year} ${hours}:${minutes}${ampm}`;
	}
</script>

<dialog bind:this={dialog} class="modal" onclose={() => (open = false)}>
	<div class="modal-box max-w-5xl">
		{#if item}
			<h3 class="text-lg font-bold">{item.appName || 'Album item'}</h3>
			{#key item.id}
				{#if item.type === 'image'}
					<img src={item.contentUri} class="w-full py-4" alt={item.appName} />
				{:else if item.type === 'video'}
					<!-- svelte-ignore a11y_media_has_caption Nintendo album clips do not provide caption tracks. -->
					<video src={item.contentUri} aria-label={item.appName || 'Album video'} controls></video>
				{:else}
					<p>Whoops! Not sure how this happened... This item isn't a video <i>or</i> an image?</p>
				{/if}
			{/key}

			<div class="flex flex-row space-x-2">
				<div class="min-w-0 flex-1 rounded bg-base-200 p-4">
					<h2 class="font-semibold">Hashtags</h2>
					<p class="truncate">{item.hashtags}</p>
				</div>

				<div class="w-fit rounded bg-base-200 p-4 whitespace-nowrap">
					<h2 class="font-semibold">Captured At</h2>
					<p>{formatDateTime(item.capturedAt)}</p>
				</div>

				<div class="w-fit rounded bg-base-200 p-4 whitespace-nowrap">
					<h2 class="font-semibold">Uploaded At</h2>
					<p>{formatDateTime(item.uploadedAt)}</p>
				</div>
			</div>
		{/if}
		{#if deleteError}
			<p class="mb-2 text-sm text-error" aria-live="polite">{deleteError}</p>
		{/if}
		<div class="modal-action">
			{#if item}
				{#if confirmDelete}
					<button type="button" class="btn btn-error" disabled={deletePending} onclick={deleteItem}>
						{deletePending ? 'Deleting...' : 'Confirm delete'}
					</button>
					<button
						type="button"
						class="btn"
						disabled={deletePending}
						onclick={() => (confirmDelete = false)}
					>
						Cancel
					</button>
				{:else}
					<button
						type="button"
						class="btn btn-outline btn-error"
						onclick={() => (confirmDelete = true)}
					>
						Delete
					</button>
				{/if}
			{/if}
			<form method="dialog">
				{#if item}
					<a class="btn" href={resolve(`/api/media/${encodeURIComponent(item.id)}`)}>Download</a>
				{/if}
				<button class="btn">Close</button>
			</form>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
