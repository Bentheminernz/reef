<script lang="ts">
	import type { FriendCodeUser } from 'nxapi/coral';
	import formatFriendCode from '$lib/utils/formatFriendCode';

	let {
		open = $bindable(false)
	}: {
		open: boolean;
	} = $props();

	const FRIEND_CODE = /^\d{4}-\d{4}-\d{4}$/;

	let friendLookupOption = $state<'discord' | 'coral'>('coral');
	let discordUsername = $state<string>('');

	let dialog = $state<HTMLDialogElement>();
	let friendCode = $state<string>('');
	let lookupState = $state<'idle' | 'loading' | 'found' | 'error'>('idle');
	let lookupUser = $state<FriendCodeUser>();
	let lookupError = $state('');
	let isFriend = $state(false);
	let isSelf = $state(false);
	let sendState = $state<'idle' | 'sending' | 'sent' | 'error'>('idle');
	let sendError = $state('');

	let lookupController: AbortController | undefined;
	let lastLookedUp = '';

	$effect(() => {
		if (open && !dialog?.open) {
			dialog?.showModal();
		} else if (!open && dialog?.open) {
			dialog.close();
		}
	});

	$effect(() => {
		if (!open) reset();
	});

	$effect(() => {
		const code = friendCode;

		if (friendLookupOption !== 'coral') return;

		if (!FRIEND_CODE.test(code)) {
			clearLookup();
			return;
		}

		if (code === lastLookedUp) return;

		const timer = setTimeout(() => {
			lastLookedUp = code;
			void lookup(code, 'coral');
		}, 350);

		return () => clearTimeout(timer);
	});

	$effect(() => {
		const username = discordUsername;

		if (friendLookupOption !== 'discord') return;

		if (!username.trim()) {
			clearLookup();
			return;
		}

		if (username === lastLookedUp) return;

		const timer = setTimeout(() => {
			lastLookedUp = username;
			void lookup(username, 'discord');
		}, 350);

		return () => clearTimeout(timer);
	});

	$effect(() => {
		// Switching tabs aborts any in-flight lookup and resets the result.
		friendLookupOption;
		lookupController?.abort();
		lookupController = undefined;
		lastLookedUp = '';
		clearResult();
	});

	function reset() {
		lookupController?.abort();
		lookupController = undefined;
		lastLookedUp = '';
		friendCode = '';
		discordUsername = '';
		clearResult();
	}

	function clearLookup() {
		lookupController?.abort();
		lookupController = undefined;
		lastLookedUp = '';
		clearResult();
	}

	function clearResult() {
		lookupState = 'idle';
		lookupUser = undefined;
		lookupError = '';
		isFriend = false;
		isSelf = false;
		sendState = 'idle';
		sendError = '';
	}

	async function lookup(query: string, option: 'coral' | 'discord') {
		lookupController?.abort();

		const controller = new AbortController();
		lookupController = controller;

		lookupState = 'loading';
		lookupUser = undefined;
		lookupError = '';
		isFriend = false;
		isSelf = false;
		sendState = 'idle';
		sendError = '';

		try {
			const [endpoint, param] =
				option === 'discord'
					? ['/api/friends/lookup/discordUsername', 'username']
					: ['/api/friends/lookup/code', 'code'];

			const response = await fetch(`${endpoint}?${param}=${encodeURIComponent(query)}`, {
				signal: controller.signal
			});

			if (!response.ok) {
				throw new Error(await errorMessage(response, 'Could not look up that user'));
			}

			const data = (await response.json()) as {
				user: FriendCodeUser;
				isFriend: boolean;
				isSelf: boolean;
			};

			lookupUser = data.user;
			isFriend = data.isFriend;
			isSelf = data.isSelf;
			lookupState = 'found';
		} catch (error) {
			if (controller.signal.aborted) return;

			lookupState = 'error';
			lookupError = error instanceof Error ? error.message : 'Could not look up that user';
		}
	}

	async function sendFriendRequest() {
		if (!lookupUser || sendState === 'sending' || sendState === 'sent') return;

		sendState = 'sending';
		sendError = '';

		try {
			const response = await fetch(`/api/friends/${lookupUser.nsaId}/request`, { method: 'POST' });

			if (!response.ok) {
				throw new Error(await errorMessage(response, 'Could not send the friend request'));
			}

			sendState = 'sent';
		} catch (error) {
			sendState = 'error';
			sendError = error instanceof Error ? error.message : 'Could not send the friend request';
		}
	}

	async function errorMessage(response: Response, fallback: string) {
		const body = (await response.json().catch(() => null)) as { message?: string } | null;
		return body?.message ?? fallback;
	}

	function onFriendCodeInput(event: Event & { currentTarget: HTMLInputElement }) {
		const formatted = formatFriendCode(event.currentTarget.value);

		if (event.currentTarget.value !== formatted) {
			event.currentTarget.value = formatted;
		}

		friendCode = formatted;
	}
</script>

<dialog bind:this={dialog} class="modal" onclose={() => (open = false)}>
	<div class="modal-box max-w-lg">
		<h2 class="mb-2 text-xl font-bold">Add Friend</h2>

		<div role="tablist" class="tabs tabs-box">
			<button
				type="button"
				role="tab"
				tabindex="0"
				onclick={() => {
					friendLookupOption = 'coral';
				}}
				class="tab w-1/2 {friendLookupOption === 'coral' ? 'tab-active' : ''}">Friend Code</button
			>
			<button
				type="button"
				role="tab"
				tabindex="0"
				onclick={() => {
					friendLookupOption = 'discord';
				}}
				class="tab w-1/2 {friendLookupOption === 'discord' ? 'tab-active' : ''}"
				>Discord Username</button
			>
		</div>

		<p class="mt-1 text-sm opacity-65">
			{#if friendLookupOption == 'coral'}
				Enter a friend code or paste a Nintendo friend link. Codes look like 0000-0000-0000.
			{:else}
				Search for a users by Discord username! Shows results for people who also use Reef.
			{/if}
		</p>

		<div class="relative mt-5">
			{#if friendLookupOption == 'coral'}
				<input
					bind:value={friendCode}
					oninput={onFriendCodeInput}
					class="input w-full pr-12 text-center font-mono text-xl tracking-widest input-lg"
					inputmode="numeric"
					placeholder="0000-0000-0000"
					aria-label="Friend code"
				/>
			{:else}
				<input
					bind:value={discordUsername}
					class="input w-full"
					placeholder="Wumpus"
					aria-label="Discord Username"
				/>
			{/if}

			{#if lookupState === 'loading'}
				<span
					class="loading absolute top-1/2 right-4 -translate-y-1/2 loading-spinner"
					aria-hidden="true"
				></span>
			{/if}
		</div>

		<div class="mt-4" aria-live="polite">
			{#if lookupState === 'found' && lookupUser}
				<div class="flex items-center gap-4 rounded-2xl border border-base-300 bg-base-200 p-4">
					<img
						src={lookupUser.image2Uri}
						alt=""
						class="size-14 shrink-0 rounded-full bg-base-300 object-cover"
					/>

					<div class="min-w-0 flex-1">
						<p class="truncate font-semibold">{lookupUser.name}</p>
						<p class="truncate font-mono text-xs opacity-55">{lookupUser.nsaId}</p>

						{#if isSelf}
							<p class="mt-1 text-xs opacity-65">This is you!</p>
						{:else if isFriend}
							<p class="mt-1 text-xs text-success">Already on your friend list</p>
						{/if}
					</div>

					<div class="shrink-0">
						{#if isSelf}
							<span class="badge badge-ghost">You</span>
						{:else if isFriend}
							<span class="badge badge-soft badge-success">Friends</span>
						{:else if sendState === 'sent'}
							<span class="badge badge-success">Request sent</span>
						{:else if sendState === 'sending'}
							<span class="loading loading-md loading-spinner text-primary"></span>
						{:else}
							<button class="btn btn-primary btn-sm" type="button" onclick={sendFriendRequest}>
								Send request
							</button>
						{/if}
					</div>
				</div>

				{#if sendState === 'error'}
					<p class="mt-2 text-sm text-error">{sendError}</p>
				{/if}
			{:else if lookupState === 'error'}
				<div class="alert rounded text-sm alert-error">
					<span>{lookupError}</span>
					{#if friendLookupOption === 'coral'}
						<button
							class="btn btn-sm"
							type="button"
							onclick={() => {
								lastLookedUp = '';
								if (friendLookupOption === 'discord') {
									void lookup(discordUsername, 'discord');
								} else {
									void lookup(friendCode, 'coral');
								}
							}}
						>
							Try again
						</button>
					{/if}
				</div>
			{:else if lookupState === 'idle'}
				<div
					class="flex items-center justify-center rounded-2xl border border-dashed border-base-300 py-6"
				>
					<p class="text-sm opacity-50">No player selected yet</p>
				</div>
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
