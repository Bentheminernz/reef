<script lang="ts">
	import type { Friend_4 } from 'nxapi/coral';
	import { timeAgo } from '$lib/utils/timeAgo';

	let {
		friend,
		selectFriend
	}: {
		friend: Friend_4;
		selectFriend?: (nsaId: string) => void;
	} = $props();

	function truncateText(str: string, maxLength: number, ellipsis: string = '...'): string {
		if (str.length <= maxLength) {
			return str;
		}
		return str.slice(0, maxLength - ellipsis.length) + ellipsis;
	}
</script>

{#if selectFriend}
	<button
		type="button"
		class="shrink-0 cursor-pointer snap-start rounded-2xl p-4 transition hover:bg-base-200"
		onclick={() => selectFriend(friend.nsaId)}
	>
		<img
			src={friend.imageUri}
			alt={friend.name}
			class="mx-auto size-18 rounded-full object-cover lg:size-24"
		/>
		<p class="lg:text-md text-center text-sm">{friend.name}</p>
		{#if friend.presence.state === 'OFFLINE'}
			<p class="text-center text-sm text-base-content/50">
				{#if friend.presence.logoutAt > 0}
					{timeAgo(friend.presence.logoutAt)}
				{:else}
					Offline
				{/if}
			</p>
		{:else if friend.presence.state === 'PLAYING'}
			<p class="text-center text-sm text-green-500">
				{truncateText(friend.presence.game.name, 25)}
			</p>
		{:else if friend.presence.state === 'ONLINE'}
			<p class="text-sm text-green-500">
				{truncateText(friend.presence.game.name, 25)}
			</p>
		{:else if friend.presence.state === 'INACTIVE'}
			<p class="text-sm text-green-500">Online</p>
		{/if}
	</button>
{:else}
	<div class="shrink-0 snap-start rounded p-4">
		<img
			src={friend.imageUri}
			alt={friend.name}
			class="mx-auto size-24 rounded-full object-cover"
		/>
		<p class="text-center">{friend.name}</p>
		{#if friend.presence.state === 'OFFLINE'}
			<p class="text-center text-sm text-base-content/50">
				Last Seen {timeAgo(friend.presence.logoutAt)}
			</p>
		{/if}
	</div>
{/if}
