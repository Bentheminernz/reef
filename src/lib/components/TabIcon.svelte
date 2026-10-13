<script lang="ts">
	type TabName = 'home' | 'friends' | 'album';

	let { tab, active = false }: { tab: TabName; active?: boolean } = $props();

	// Full literal class strings so Tailwind can detect them.
	// Colours come from the same nintendo-* theme tokens the tab hover states use.
	const tones = {
		home: {
			stroke: 'text-nintendo-home-light dark:text-nintendo-home-dark',
			tint: 'fill-nintendo-home-light/25 dark:fill-nintendo-home-dark/25',
			solid: 'fill-nintendo-home-light dark:fill-nintendo-home-dark'
		},
		friends: {
			stroke: 'text-nintendo-friends-light dark:text-nintendo-friends-dark',
			tint: 'fill-nintendo-friends-light/25 dark:fill-nintendo-friends-dark/25',
			solid: 'fill-nintendo-friends-light dark:fill-nintendo-friends-dark'
		},
		album: {
			stroke: 'text-nintendo-album-light dark:text-nintendo-album-dark',
			tint: 'fill-nintendo-album-light/25 dark:fill-nintendo-album-dark/25',
			solid: 'fill-nintendo-album-light dark:fill-nintendo-album-dark'
		}
	};

	const tone = $derived(tones[tab]);
</script>

<div class="grid size-full place-items-center">
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2.5"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
		class="size-12 transition-colors duration-300 lg:size-14 {tone.stroke}"
	>
		{#if tab === 'home'}
			<path
				class="transition-colors duration-300 {active ? tone.tint : 'fill-transparent'}"
				d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
			/>
			<path
				class="transition-colors duration-300 {active ? tone.solid : 'fill-transparent'}"
				d="M15 21v-7a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v7"
			/>
		{:else if tab === 'friends'}
			<rect
				class="transition-colors duration-300 {active ? tone.tint : 'fill-transparent'}"
				width="18"
				height="18"
				x="3"
				y="3"
				rx="2"
				ry="2"
			/>
			<path d="M9 10V9" />
			<path d="M15 10V9" />
			<path d="M16.472 15a6 6 0 01-8.943 0" />
		{:else}
			<rect
				class="transition-colors duration-300 {active ? tone.tint : 'fill-transparent'}"
				width="18"
				height="18"
				x="3"
				y="3"
				rx="2"
				ry="2"
			/>
			<circle cx="9" cy="9" r="2" />
			<path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
		{/if}
	</svg>
</div>
