<script lang="ts">
	import type { Game } from 'nxapi/coral';
	import getTitleIdFromEcUrl from '$lib/utils/getTitleIdFromEcUrl';

	let {
		game
	}: {
		game: Game;
	} = $props();

	let gameUri = $derived(
		`https://fancy.org.uk/api/nxapi/title/${getTitleIdFromEcUrl(game.shopUri)}/redirect?source=Reef`
	);

	function formatPlayTime(minutes: number) {
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;

		if (!hours) return `${remainingMinutes} min`;
		if (!remainingMinutes) return `${hours} hr`;

		return `${hours} hr ${remainingMinutes} min`;
	}
</script>

<a rel="external" target="_blank" href={gameUri}>
	<div class="flex gap-3 rounded-xl bg-base-200 p-3">
		<img src={game.imageUri} alt={game.name} class="size-16 rounded-xl object-cover" />
		<div class="min-w-0">
			<p class="truncate font-medium">{game.name}</p>
			<p class="text-sm opacity-70">{formatPlayTime(game.totalPlayTime)}</p>
			{#if game.firstPlayedAt}
				<p class="text-xs opacity-60">
					First played {new Date(game.firstPlayedAt * 1000).toLocaleDateString()}
				</p>
			{/if}
		</div>
	</div>
</a>
