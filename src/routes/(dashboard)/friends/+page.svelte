<script lang="ts">
	import AddFriendModal from '$lib/components/AddFriendModal.svelte';
	import FriendItem from '$lib/components/FriendItem.svelte';
	import FriendModal from '$lib/components/FriendModal.svelte';
	import FriendItemSkeleton from '$lib/components/Skeletons/FriendItemSkeleton.svelte';
	import { fade } from 'svelte/transition';
	import type { PageProps } from './$types';
	import { page } from '$app/state';

	let { data }: PageProps = $props();

	let selectedFriendId = $state('');
	let friendInfoModalOpen = $state(false);
	let friendAddModalOpen = $state(false);

	function selectFriend(nsaId: string) {
		selectedFriendId = nsaId;
		friendInfoModalOpen = true;
	}

	$effect(() => {
		const pop = page.url.searchParams.get('pop');
		if (pop && pop !== selectedFriendId) {
			selectedFriendId = pop;
			friendInfoModalOpen = true;
		}
	});
</script>

<button
	onclick={() => {
		friendAddModalOpen = true;
	}}
	class="btn">Add Friend</button
>

<div class="grid">
	{#await data.friends}
		<div
			class="col-start-1 row-start-1 grid grid-cols-3 gap-2 xl:grid-cols-4 2xl:grid-cols-5"
			aria-hidden="true"
			out:fade={{ duration: 200 }}
		>
			{#each { length: 10 } as _, i (i)}
				<FriendItemSkeleton />
			{/each}
		</div>
	{:then friends}
		{@const selectedFriend = friends.friends.find((friend) => friend.nsaId === selectedFriendId)}
		<FriendModal friend={selectedFriend} bind:open={friendInfoModalOpen} />
		<AddFriendModal bind:open={friendAddModalOpen} />

		<div
			class="col-start-1 row-start-1 grid grid-cols-3 gap-2 xl:grid-cols-4 2xl:grid-cols-5"
			in:fade={{ duration: 200 }}
		>
			{#each friends.friends as friend (friend.nsaId)}
				<FriendItem {friend} {selectFriend} />
			{/each}
		</div>
	{:catch error}
		<p class="col-start-1 row-start-1">Failed to load friends: {error.message}</p>
	{/await}
</div>
