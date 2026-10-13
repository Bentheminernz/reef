<script lang="ts">
	import FriendItem from '$lib/components/FriendItem.svelte';
	import FriendModal from '$lib/components/FriendModal.svelte';
	import GameServices from '$lib/components/GameServices.svelte';
	import MediaItem from '$lib/components/MediaItem.svelte';
	import MediaModal from '$lib/components/MediaModal.svelte';
	import FriendItemSkeleton from '$lib/components/Skeletons/FriendItemSkeleton.svelte';
	import GWSSkeleton from '$lib/components/Skeletons/GWSSkeleton.svelte';
	import MediaSkeleton from '$lib/components/Skeletons/MediaSkeleton.svelte';
	import { fade } from 'svelte/transition';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let selectedFriendId = $state('');
	let friendModalOpen = $state(false);
	let selectedMediaId = $state('');
	let mediaModalOpen = $state(false);

	function selectFriend(nsaId: string) {
		selectedFriendId = nsaId;
		friendModalOpen = true;
	}

	function selectMedia(id: string) {
		selectedMediaId = id;
		mediaModalOpen = true;
	}
</script>

<h1 class="text-xl font-bold">Friends</h1>
<div class="grid">
	{#await data.friends}
		<div
			class="col-start-1 row-start-1 flex snap-x snap-mandatory flex-row overflow-x-scroll"
			aria-hidden="true"
			out:fade={{ duration: 200 }}
		>
			{#each Array.from({ length: 8 }, (_, index) => index) as index (index)}
				<FriendItemSkeleton />
			{/each}
		</div>
	{:then friends}
		{@const selectedFriend = friends.friends.find((friend) => friend.nsaId === selectedFriendId)}
		<div
			class="col-start-1 row-start-1 flex snap-x snap-mandatory flex-row overflow-x-scroll"
			in:fade={{ duration: 200 }}
		>
			<FriendModal friend={selectedFriend} bind:open={friendModalOpen} />
			{#each friends.friends as friend (friend.nsaId)}
				<FriendItem {friend} {selectFriend} />
			{/each}
		</div>
	{:catch error}
		<p class="col-start-1 row-start-1">Failed to load friends: {error.message}</p>
	{/await}
</div>

<hr class="border-0.5 my-4 border-gray-400/40" />

<h1 class="mb-2 text-xl font-bold">Game Services</h1>
<div class="grid grid-cols-[minmax(0,1fr)]">
	{#await data.webServices}
		<div
			class="col-start-1 row-start-1 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
			aria-hidden="true"
			out:fade={{ duration: 200 }}
		>
			{#each Array.from({ length: 5 }, (_, index) => index) as index (index)}
				<GWSSkeleton />
			{/each}
		</div>
	{:then webServices}
		<div class="col-start-1 row-start-1" in:fade={{ duration: 200 }}>
			<GameServices services={webServices} />
		</div>
	{:catch error}
		<p class="col-start-1 row-start-1">Failed to load game services: {error.message}</p>
	{/await}
</div>

<hr class="border-0.5 my-4 border-gray-400/40" />

<h1 class="mb-2 text-xl font-bold">Media</h1>
<div class="grid">
	{#await data.media}
		<div
			class="col-start-1 row-start-1 flex snap-x snap-mandatory scrollbar-none flex-row space-x-4 overflow-x-scroll"
			aria-hidden="true"
			out:fade={{ duration: 200 }}
		>
			{#each Array.from({ length: 8 }, (_, index) => index) as index (index)}
				<div class="w-80 shrink-0 snap-start">
					<MediaSkeleton />
				</div>
			{/each}
		</div>
	{:then media}
		{@const selectedMedia = media.media.find((item) => item.id === selectedMediaId)}
		<div
			class="col-start-1 row-start-1 flex snap-x snap-mandatory scrollbar-none flex-row space-x-4 overflow-x-scroll"
			in:fade={{ duration: 200 }}
		>
			<MediaModal item={selectedMedia} bind:open={mediaModalOpen} />
			{#each media.media.slice(0, 10) as item (item.id)}
				<div class="w-80 shrink-0 snap-start">
					<MediaItem media={item} selectItem={selectMedia} />
				</div>
			{/each}
		</div>
	{:catch error}
		<p class="col-start-1 row-start-1">Failed to load media: {error.message}</p>
	{/await}
</div>
