<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import type { Friend_4 } from 'nxapi/coral';
	import { timeAgo } from '$lib/utils/timeAgo';
	import type { SignupBlockedReason } from '$lib/types/signup';

	let { reason = null, linked = false }: { reason?: SignupBlockedReason | null; linked?: boolean } =
		$props();

	let friends = $state<Friend_4[] | null>(null);
	let loading = $state(true);
	let loadError = $state('');
	let unfriending = $state<string | null>(null);
	let actionError = $state('');
	let retrying = $state(false);
	let enabling = $state(false);

	$effect(() => {
		if (reason === 'friend-limit') {
			void loadFriends();
		}
	});

	async function loadFriends() {
		loading = true;
		loadError = '';
		actionError = '';

		try {
			const response = await fetch('/api/friends');

			if (!response.ok) {
				throw new Error(await errorMessage(response, 'Could not load your friends'));
			}

			const data = (await response.json()) as { friends: Friend_4[] };
			friends = data.friends;
		} catch (error) {
			loadError = error instanceof Error ? error.message : 'Could not load your friends';
		} finally {
			loading = false;
		}
	}

	async function unfriend(friend: Friend_4) {
		if (unfriending != null) return;

		unfriending = friend.nsaId;
		actionError = '';

		try {
			const response = await fetch(`/api/friends/${friend.nsaId}`, { method: 'DELETE' });

			if (!response.ok) {
				throw new Error(await errorMessage(response, 'Could not unfriend that user'));
			}

			friends = friends?.filter((entry) => entry.nsaId !== friend.nsaId) ?? null;
		} catch (error) {
			actionError = error instanceof Error ? error.message : 'Could not unfriend that user';
		} finally {
			unfriending = null;
		}
	}

	async function continueSignup() {
		if (retrying) return;

		retrying = true;
		actionError = '';

		try {
			if (!linked) {
				const linkResponse = await fetch('/api/discord/generate-url');

				if (!linkResponse.ok) throw new Error('Could not start Discord linking.');

				const { authoriseURL } = (await linkResponse.json()) as { authoriseURL?: string };

				if (typeof authoriseURL !== 'string') {
					throw new Error('Discord returned an invalid authorisation URL.');
				}

				window.location.href = authoriseURL;
				return;
			}

			const response = await fetch('/api/signup/retry', { method: 'POST' });
			const data = (await response.json().catch(() => null)) as { status?: string } | null;

			if (!response.ok || data?.status !== 'complete') {
				throw new Error(
					data?.status === 'friend-limit'
						? 'You still need to unfriend someone before continuing.'
						: data?.status === 'requests-disabled'
							? 'Friend requests still seem to be disabled on your Nintendo account. Try again in a moment.'
							: data?.status === 'no-capacity'
								? 'Reef has no room for new Discord presence users right now. Try again later.'
								: 'Could not add the system user right now. Try again in a moment.'
				);
			}

			await invalidateAll();
		} catch (error) {
			actionError =
				error instanceof Error ? error.message : 'Could not complete sign-up right now.';
		} finally {
			retrying = false;
		}
	}

	async function enableFriendRequestsAndRetry() {
		if (enabling || retrying) return;

		enabling = true;
		actionError = '';

		try {
			const response = await fetch('/api/nso/changePermissions', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ type: 'friend-request', value: true })
			});

			if (!response.ok) {
				throw new Error(
					await errorMessage(
						response,
						'Could not enable friend requests. You can also enable them on your Switch and try again.'
					)
				);
			}

			await continueSignup();
		} catch (error) {
			actionError =
				error instanceof Error ? error.message : 'Could not enable friend requests right now.';
		} finally {
			enabling = false;
		}
	}

	function statusLine(friend: Friend_4): string {
		const presence = friend.presence;

		if (presence.state === 'OFFLINE') {
			return `Offline · last seen ${timeAgo(presence.logoutAt)}`;
		}
		if ('name' in presence.game) {
			return `Online · ${presence.game.name}`;
		}
		return 'Online';
	}

	async function errorMessage(response: Response, fallback: string) {
		const body = (await response.json().catch(() => null)) as { message?: string } | null;
		return body?.message ?? fallback;
	}
</script>

<div
	class="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
	role="dialog"
	aria-modal="true"
	aria-labelledby={reason === 'requests-disabled'
		? 'requests-disabled-title'
		: reason === 'friend-limit'
			? 'friend-limit-title'
			: 'enrolment-failed-title'}
>
	<div
		class="flex max-h-full w-full max-w-md flex-col gap-4 overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-xl"
	>
		{#if reason === 'requests-disabled'}
			<header class="flex flex-col gap-2 px-5 pt-5">
				<div class="flex items-center gap-3">
					<div
						class="grid size-11 shrink-0 place-items-center rounded-full bg-warning/15 text-warning"
					>
						<CircleAlert class="size-6" aria-hidden="true" />
					</div>
					<div>
						<h2 id="requests-disabled-title" class="text-lg font-bold">Turn on friend requests</h2>
						<p class="text-xs opacity-65">Discord enrolment</p>
					</div>
				</div>

				<p class="text-sm opacity-80">
					Reef adds a system user to your friends list so your presence can be shown on Discord.
					Your Nintendo account currently has friend requests turned off, so the system user can't
					add you. We can turn them back on for you, or you can do it on your Switch.
				</p>
			</header>

			<div class="flex flex-col gap-2 px-5">
				<div class="alert rounded text-sm alert-info">
					<span>Friend requests are currently disabled on your Nintendo account.</span>
				</div>
			</div>

			<footer class="flex flex-col gap-2 border-t border-base-300 px-5 py-4">
				{#if actionError}
					<p class="text-sm text-error" aria-live="polite">{actionError}</p>
				{/if}

				<button
					class="btn w-full btn-primary"
					type="button"
					onclick={enableFriendRequestsAndRetry}
					disabled={enabling || retrying}
				>
					{enabling
						? 'Enabling friend requests…'
						: retrying
							? 'Adding system user…'
							: 'Enable friend requests and try again'}
				</button>

				<button
					class="btn w-full btn-outline"
					type="button"
					onclick={continueSignup}
					disabled={retrying}
				>
					I've enabled them on my Switch — try again
				</button>
			</footer>
		{:else if reason === 'friend-limit'}
			<header class="flex flex-col gap-2 px-5 pt-5">
				<div class="flex items-center gap-3">
					<div
						class="grid size-11 shrink-0 place-items-center rounded-full bg-warning/15 text-warning"
					>
						<CircleAlert class="size-6" aria-hidden="true" />
					</div>
					<div>
						<h2 id="friend-limit-title" class="text-lg font-bold">Make room for our system user</h2>
						<p class="text-xs opacity-65">Discord enrolment</p>
					</div>
				</div>

				<p class="text-sm opacity-80">
					Reef adds a system user to your friends list so your presence can be shown on Discord.
					You're at the 300-friend limit, so unfriend someone below (or on your Switch) to make
					room.
				</p>
			</header>

			<div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-5">
				{#if loading}
					<div class="grid place-items-center py-10">
						<span class="loading loading-lg loading-spinner text-primary" aria-hidden="true"></span>
					</div>
				{:else if loadError}
					<div class="alert rounded text-sm alert-error">
						<span>{loadError}</span>
						<button class="btn btn-sm" type="button" onclick={loadFriends}>Try again</button>
					</div>
				{:else if friends}
					<p class="text-xs opacity-60">{friends.length}/300 friends · sorted by last online</p>

					{#each friends as friend (friend.nsaId)}
						<div class="flex items-center gap-3 rounded-xl border border-base-300 bg-base-200 p-3">
							<img
								src={friend.imageUri}
								alt=""
								class="size-11 shrink-0 rounded-full bg-base-300 object-cover"
							/>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-semibold">{friend.name}</p>
								<p class="truncate text-xs opacity-60">{statusLine(friend)}</p>
							</div>

							{#if unfriending === friend.nsaId}
								<span class="loading loading-sm loading-spinner text-primary" aria-hidden="true"
								></span>
							{:else}
								<button
									class="btn shrink-0 btn-outline btn-error btn-sm"
									type="button"
									onclick={() => unfriend(friend)}
								>
									Unfriend
								</button>
							{/if}
						</div>
					{/each}
				{/if}
			</div>

			<footer class="flex flex-col gap-2 border-t border-base-300 px-5 py-4">
				{#if actionError}
					<p class="text-sm text-error" aria-live="polite">{actionError}</p>
				{/if}

				<button
					class="btn w-full btn-primary"
					type="button"
					onclick={continueSignup}
					disabled={retrying}
				>
					{retrying ? 'Adding system user…' : "I've made room — try again"}
				</button>
			</footer>
		{:else}
			<header class="flex flex-col gap-2 px-5 pt-5">
				<div class="flex items-center gap-3">
					<div
						class="grid size-11 shrink-0 place-items-center rounded-full bg-warning/15 text-warning"
					>
						<CircleAlert class="size-6" aria-hidden="true" />
					</div>
					<div>
						<h2 id="enrolment-failed-title" class="text-lg font-bold">
							{reason === 'no-capacity' ? 'No room right now' : "Couldn't add our system user"}
						</h2>
						<p class="text-xs opacity-65">Discord enrolment</p>
					</div>
				</div>

				<p class="text-sm opacity-80">
					{reason === 'no-capacity'
						? 'All of our system users are full right now. Please try again later.'
						: "We couldn't add our system user to your friends list. Please try again in a moment."}
				</p>
			</header>

			<footer class="flex flex-col gap-2 border-t border-base-300 px-5 py-4">
				{#if actionError}
					<p class="text-sm text-error" aria-live="polite">{actionError}</p>
				{/if}

				<button
					class="btn w-full btn-primary"
					type="button"
					onclick={continueSignup}
					disabled={retrying}
				>
					{retrying ? 'Adding system user…' : 'Try again'}
				</button>
			</footer>
		{/if}
	</div>
</div>
