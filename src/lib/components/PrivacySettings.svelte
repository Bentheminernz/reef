<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import type { PlayLogPermissions, PresencePermissions } from 'nxapi/coral';
	import type { UserPermissionsSummary } from '$lib/types/settings';

	let {
		userPermissions
	}: {
		userPermissions?: UserPermissionsSummary | null;
	} = $props();

	let presence = $state<PresencePermissions | undefined>(undefined);
	let playLog = $state<PlayLogPermissions | undefined>(undefined);
	let friendRequests = $state<boolean | undefined>(undefined);
	let allowDiscordUsernameSearching = $state<boolean | undefined>(undefined);

	let saving = $state(false);
	let message = $state('');
	let error = $state('');

	type PermissionsResponse = {
		userPermissions?: {
			coral?: UserPermissionsSummary['coral'] | null;
			reef: UserPermissionsSummary['reef'];
		} | null;
	};

	$effect(() => {
		if (userPermissions == null) return;
		presence = userPermissions.coral.permissions.presence;
		playLog = userPermissions.coral.permissions.playLog;
		friendRequests = userPermissions.coral.permissions.friendRequestReception;
		allowDiscordUsernameSearching = userPermissions.reef.allowDiscordUsernameSearching;
	});

	const presenceOptions = [
		{ value: 'FRIENDS', label: 'Friends' },
		{ value: 'FAVORITE_FRIENDS', label: 'Best Friends' },
		{ value: 'SELF', label: 'No One' }
	];

	const playLogOptions = [
		{ value: 'EVERYONE', label: 'Everyone' },
		{ value: 'FRIENDS', label: 'Friends' },
		{ value: 'FAVORITE_FRIENDS', label: 'Best Friends' },
		{ value: 'SELF', label: 'No One' }
	];

	async function save(
		type: 'presence' | 'play-log' | 'friend-request' | 'discord-username-search',
		value: unknown,
		rollback: () => void
	) {
		if (saving) return;

		saving = true;
		message = '';
		error = '';

		try {
			const endpoint =
				type === 'discord-username-search'
					? '/api/privacy/changePermissions'
					: '/api/nso/changePermissions';

			const response = await fetch(endpoint, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ type, value })
			});

			if (!response.ok) {
				throw new Error(await errorMessage(response, 'Could not update that setting.'));
			}

			const data = (await response.json().catch(() => ({}))) as PermissionsResponse;

			if (data.userPermissions) {
				const coral = data.userPermissions.coral;

				if (coral) {
					presence = coral.permissions.presence;
					playLog = coral.permissions.playLog;
					friendRequests = coral.permissions.friendRequestReception;
				}

				allowDiscordUsernameSearching = data.userPermissions.reef.allowDiscordUsernameSearching;
			}

			message = 'Saved.';

			void invalidateAll();
		} catch (cause) {
			rollback();
			error = cause instanceof Error ? cause.message : 'Could not update that setting.';
		} finally {
			saving = false;
		}
	}

	async function errorMessage(response: Response, fallback: string) {
		const body = (await response.json().catch(() => null)) as { message?: string } | null;
		return body?.message ?? fallback;
	}
</script>

<section aria-labelledby="privacy-heading" id="privacy-controls">
	<header class="mb-3">
		<h2 id="privacy-heading" class="text-lg font-semibold">Privacy</h2>
		<p class="mt-1 max-w-2xl text-sm opacity-65">
			Control who can see your Switch activity, who can send you friend requests, and whether other
			Reef users can find you by your Discord username.
		</p>
	</header>

	{#if userPermissions == null}
		<div class="flex flex-col gap-4">
			<div class="alert items-start alert-info" role="alert">
				<CircleAlert class="size-5 shrink-0" aria-hidden="true" />
				<span>
					Your privacy settings haven't been synced from Nintendo yet. They'll show up here after
					your next login.
				</span>
			</div>

			<button
				class="btn w-full btn-outline sm:w-auto"
				type="button"
				onclick={() => invalidateAll()}
			>
				Try again
			</button>
		</div>
	{:else}
		<div class="overflow-hidden rounded-2xl border border-base-300 bg-base-200">
			<div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
				<span class="min-w-0 flex-1">
					<span class="block font-semibold">Presence visibility</span>
					<span class="mt-0.5 block text-sm opacity-65">
						Who can see your presence. The system user needs to see you for Discord Rich Presence to
						work.
					</span>
				</span>

				<select
					class="select w-full sm:w-48"
					value={presence}
					disabled={saving}
					onchange={(event) => {
						const next = event.currentTarget.value as PresencePermissions;
						const previous = presence;

						presence = next;
						void save('presence', next, () => {
							presence = previous;
						});
					}}
				>
					{#each presenceOptions as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>

			<div class="border-t border-base-300"></div>

			<div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
				<span class="min-w-0 flex-1">
					<span class="block font-semibold">Play log visibility</span>
					<span class="mt-0.5 block text-sm opacity-65">
						Who can see which games you've been playing on your profile.
					</span>
				</span>

				<select
					class="select w-full sm:w-48"
					value={playLog}
					disabled={saving}
					onchange={(event) => {
						const next = event.currentTarget.value as PlayLogPermissions;
						const previous = playLog;

						playLog = next;
						void save('play-log', next, () => {
							playLog = previous;
						});
					}}
				>
					{#each playLogOptions as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>

			<div class="border-t border-base-300"></div>

			<div class="flex items-center gap-4 p-5">
				<span class="min-w-0 flex-1">
					<span class="block font-semibold">Allow friend requests</span>
					<span class="mt-0.5 block text-sm opacity-65">
						Whether other players can send you friend requests. Turning this off can stop the system
						user from adding you, which breaks Discord presence setup.
					</span>
				</span>

				<input
					type="checkbox"
					class="toggle toggle-primary"
					checked={friendRequests ?? false}
					disabled={saving}
					onchange={(event) => {
						const next = event.currentTarget.checked;
						const previous = friendRequests;

						friendRequests = next;
						void save('friend-request', next, () => {
							friendRequests = previous;
						});
					}}
				/>
			</div>

			<div class="border-t border-base-300"></div>

			<div class="flex items-center gap-4 p-5">
				<span class="min-w-0 flex-1">
					<span class="block font-semibold">Allow Discord username search</span>
					<span class="mt-0.5 block text-sm opacity-65">
						Let other Reef users find you by your Discord username when they're adding friends.
					</span>
				</span>

				<input
					type="checkbox"
					class="toggle toggle-primary"
					checked={allowDiscordUsernameSearching ?? true}
					disabled={saving}
					onchange={(event) => {
						const next = event.currentTarget.checked;
						const previous = allowDiscordUsernameSearching;

						allowDiscordUsernameSearching = next;
						void save('discord-username-search', next, () => {
							allowDiscordUsernameSearching = previous;
						});
					}}
				/>
			</div>
		</div>

		{#if message}
			<p class="mt-5 text-sm text-success" aria-live="polite">{message}</p>
		{/if}

		{#if error}
			<p class="mt-5 text-sm text-error" aria-live="polite">{error}</p>
		{/if}
	{/if}
</section>
