<script lang="ts">
	import type { Media } from 'nxapi/coral';

	let { media, selectItem }: { media: Media; selectItem?: (id: string) => void } = $props();

	function formatDuration(milliseconds: number) {
		const totalSeconds = Math.floor(milliseconds / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;

		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}
</script>

<button
	type="button"
	onclick={() => selectItem?.(media.id)}
	class="block w-full text-left"
	class:cursor-pointer={selectItem}
>
	<div class="relative aspect-video w-full overflow-hidden rounded-xl">
		{#if media.type === 'image'}
			<img
				src={media.thumbnailUri}
				class="size-full object-cover"
				loading="lazy"
				alt={media.appName}
			/>
		{:else if media.type === 'video'}
			<img
				src={media.thumbnailUri}
				class="size-full object-cover"
				loading="lazy"
				alt={media.appName}
			/>
			<span
				class="absolute right-1.5 bottom-1.5 rounded bg-black/75 px-1.5 py-0.5 text-xs leading-none font-medium text-white"
			>
				{formatDuration(media.videoDuration)}
			</span>
		{:else}
			<p>huh</p>
		{/if}
	</div>
	<p class="mt-1 line-clamp-1 font-semibold">{media.appName}</p>
</button>
