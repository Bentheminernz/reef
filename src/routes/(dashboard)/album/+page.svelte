<script lang="ts">
	import MediaItem from '$lib/components/MediaItem.svelte';
	import MediaModal from '$lib/components/MediaModal.svelte';
	import MediaSkeleton from '$lib/components/Skeletons/MediaSkeleton.svelte';
	import { fade } from 'svelte/transition';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let selectedItem = $state<string>('');
	let modalOpen = $state(false);

	function selectItem(id: string) {
		selectedItem = id;
		modalOpen = true;
	}
</script>

<div class="mt-4 grid">
	{#await data.media}
		<div
			class="col-start-1 row-start-1 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4"
			aria-hidden="true"
			out:fade={{ duration: 200 }}
		>
			{#each Array.from({ length: 8 }, (_, index) => index) as index (index)}
				<MediaSkeleton />
			{/each}
		</div>
	{:then media}
		{@const item = media.media.find((item) => item.id === selectedItem)}

		<MediaModal {item} bind:open={modalOpen} />

		<div
			class="col-start-1 row-start-1 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4"
			in:fade={{ duration: 200 }}
		>
			{#each media.media as item (item.id)}
				<MediaItem media={item} {selectItem} />
			{/each}
		</div>
	{:catch error}
		<p class="col-start-1 row-start-1">Failed to load media: {error.message}</p>
	{/await}
</div>
