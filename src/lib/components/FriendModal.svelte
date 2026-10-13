<script lang="ts">
	import { resolve } from '$app/paths';
	import Star from '@lucide/svelte/icons/star';
	import type { FriendRouteChannel, Friend_4, Game } from 'nxapi/coral';
	import PlayLogItem from './PlayLogItem.svelte';
	import { timeAgo } from '$lib/utils/timeAgo';
	import getTitleIdFromEcUrl from '$lib/utils/getTitleIdFromEcUrl';

	let {
		friend,
		open = $bindable(false)
	}: {
		friend: Friend_4 | undefined;
		open?: boolean;
	} = $props();

	let dialog = $state<HTMLDialogElement>();
	let loading = $state(false);
	let loadError = $state<string>();
	let result = $state<{ friend: Friend_4; playLog: Game[] }>();
	let displayedFriend = $derived(result?.friend ?? friend);
	let favouriteOverride = $state<{ nsaId: string; value: boolean }>();
	let favouritePending = $state(false);
	let favouriteError = $state('');
	let isFavourite = $derived(
		favouriteOverride && favouriteOverride.nsaId === displayedFriend?.nsaId
			? favouriteOverride.value
			: (displayedFriend?.isFavoriteFriend ?? false)
	);

	$effect(() => {
		if (open && !dialog?.open) {
			dialog?.showModal();
		} else if (!open && dialog?.open) {
			dialog.close();
		}
	});

	$effect(() => {
		if (open) favouriteOverride = undefined;
	});

	$effect(() => {
		if (!open || !friend) return;

		const controller = new AbortController();
		void fetchFriend(friend.nsaId, controller.signal);

		return () => controller.abort();
	});

	async function fetchFriend(nsaId: string, signal: AbortSignal) {
		loading = true;
		loadError = undefined;
		result = undefined;

		try {
			const response = await fetch(resolve('/api/friends/[nsaId]', { nsaId }), { signal });

			if (!response.ok) {
				throw new Error('Unable to load friend details');
			}

			result = (await response.json()) as { friend: Friend_4; playLog: Game[] };
		} catch (error) {
			if (!signal.aborted) {
				loadError = error instanceof Error ? error.message : 'Unable to load friend details';
			}
		} finally {
			if (!signal.aborted) {
				loading = false;
			}
		}
	}

	async function toggleFriendFavourite(next: boolean) {
		if (!displayedFriend || favouritePending) return;

		const nsaId = displayedFriend.nsaId;

		favouritePending = true;
		favouriteError = '';
		favouriteOverride = { nsaId, value: next };

		try {
			const response = await fetch(resolve('/api/friends/[nsaId]/favourite', { nsaId }), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ favourite: next })
			});

			if (!response.ok) {
				throw new Error(await responseMessage(response, 'Could not update favourite'));
			}

			const data = (await response.json()) as { friend?: Friend_4 };

			if (result && data.friend) {
				result = { friend: data.friend, playLog: result.playLog };
			}
		} catch (error) {
			favouriteOverride = { nsaId, value: !next };
			favouriteError = error instanceof Error ? error.message : 'Could not update favourite';
		} finally {
			favouritePending = false;
		}
	}

	async function responseMessage(response: Response, fallback: string) {
		const body = (await response.json().catch(() => null)) as { message?: string } | null;
		return body?.message ?? fallback;
	}

	const friendRouteChannelDisplay: Record<FriendRouteChannel, string> = {
		FRIEND_CODE: 'By exchanging friend codes.',
		NX_FACED: 'Searched for local users.',
		// Should show the app channel, this is fallback (FriendRoute.appName)
		NINTENDO_ACCOUNT: 'Added via a Nintendo Smart Device Game.',
		// Show the application details and ingame name
		IN_APP: 'Added within a Game.',
		'3DS': 'Added from a Nintendo 3DS System.',
		// Skye to figure this out
		NNID: 'Added via Nintendo Network.',
		TWITTER: 'Added via Twitter.',
		FACEBOOK: 'Added via Facebook.',
		WECHAT: 'Added via WeChat.',
		CAMPUS: 'Added via GameChat.'
	};

	const fmt = (s: number) =>
		new Date(s * 1000)
			.toLocaleString('en-NZ', {
				day: '2-digit',
				month: '2-digit',
				year: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
				hour12: true
			})
			.replace(/,|\s(?=[ap]m)/gi, '')
			.toLowerCase();
</script>

<dialog bind:this={dialog} class="modal" onclose={() => (open = false)}>
	<div class="modal-box max-w-3xl">
		{#if displayedFriend}
			<div class="flex items-center gap-4">
				<img
					src={displayedFriend.imageUri}
					alt={displayedFriend.name}
					class="size-20 rounded-full object-cover"
				/>
				<div>
					<h3 class="text-xl font-bold">{displayedFriend.name}</h3>
					<p class="text-sm opacity-70">
						{#if displayedFriend.presence.state === 'OFFLINE'}
							{timeAgo(displayedFriend.presence.logoutAt)}
						{:else if displayedFriend.presence.state === 'PLAYING'}
							<span class="text-green-500">{displayedFriend.presence.game.name}</span>
						{:else if displayedFriend.presence.state === 'ONLINE'}
							<span class="text-green-500">{displayedFriend.presence.game.name}</span>
						{:else if displayedFriend.presence.state === 'INACTIVE'}
							Online
						{/if}
					</p>

					<!-- {#if ['PLAYING', 'ONLINE'].includes(displayedFriend.presence.state) && displayedFriend.presence.game }
						<img src={displayedFriend.presence.game.imageUri } />
					{/if} -->
				</div>

				<button
					type="button"
					class="btn ml-auto shrink-0"
					aria-label={isFavourite
						? `Remove ${displayedFriend.name} from favourites`
						: `Add ${displayedFriend.name} to favourites`}
					aria-pressed={isFavourite}
					disabled={favouritePending}
					onclick={() => toggleFriendFavourite(!isFavourite)}
				>
					<Star
						fill={isFavourite ? 'currentColor' : 'none'}
						color="currentColor"
						class={isFavourite ? 'text-warning' : ''}
					/>

					Best Friend
				</button>
			</div>

			{#if favouriteError}
				<p class="mt-2 text-sm text-error" aria-live="polite">{favouriteError}</p>
			{/if}
		{/if}

		<div class="mt-6 max-h-[60vh] overflow-y-auto">
			{#if loading}
				<div class="flex justify-center py-12">
					<span class="loading loading-lg loading-spinner"></span>
				</div>
			{:else if loadError}
				<p class="alert alert-error">{loadError}</p>
			{:else if result}
				<h4 class="mb-3 text-lg font-semibold">Play activity</h4>
				{#if result.playLog.length}
					<div class="grid gap-3 sm:grid-cols-2">
						{#each result.playLog as game (game.shopUri)}
							<PlayLogItem {game} />
						{/each}
					</div>
				{:else}
					<p class="opacity-70">No visible play activity.</p>
				{/if}

				<h3 class="mt-3 text-lg font-semibold">How You Became Friends:</h3>
				<p class="font-sm opacity-65">
					{#if (displayedFriend?.route.channel as string) === 'NINTENDO_ACCOUNT' && displayedFriend?.route.appName}
						{displayedFriend.route.appName}
					{:else if (displayedFriend?.route.channel as string) === 'IN_APP' && displayedFriend?.route.appName}
						{@const titleId = getTitleIdFromEcUrl(displayedFriend?.route.shopUri)}
						<a
							href="https://fancy.org.uk/api/nxapi/title/{titleId}/redirect?source=Reef"
							target="_blank"
							class="link"
						>
							{displayedFriend.route.appName}
						</a>

						<span class="text-xs opacity-80">
							{#if displayedFriend?.route.userName}
								<br />In-Game Name:<br />
								{displayedFriend?.route.userName}
							{/if}
						</span>
					{:else}
						{(displayedFriend && friendRouteChannelDisplay[displayedFriend.route.channel]) ??
							'Unknown'}
					{/if}
				</p>

				<h3 class="mt-3 text-lg font-semibold">When You Became Friends:</h3>
				{#if displayedFriend?.friendCreatedAt}
					<p class="font-sm opacity-65">{fmt(displayedFriend.friendCreatedAt)}</p>
				{/if}
			{/if}
		</div>

		<div class="modal-action">
			<form method="dialog">
				<button class="btn">Close</button>
			</form>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
