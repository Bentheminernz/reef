<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import type { PlayLogPermissions, PresencePermissions } from 'nxapi/coral';
	import type { UserPermissionsSummary } from '$lib/types/settings';
	import { errorMessage, ReefError } from '$lib/types/errors';
	import { m } from '$lib/paraglide/messages';

	let {
		userPermissions
	}: {
		userPermissions?: UserPermissionsSummary | null;
	} = $props();

	let presence = $state<PresencePermissions | undefined>(undefined);
	let playLog = $state<PlayLogPermissions | undefined>(undefined);
	let friendRequests = $state<boolean | undefined>(undefined);

	let saving = $state(false);
	let message = $state('');
	let error = $state<ReefError>();

	$effect(() => {
		if (userPermissions == null) return;
		presence = userPermissions.permissions.presence;
		playLog = userPermissions.permissions.playLog;
		friendRequests = userPermissions.permissions.friendRequestReception;
	});

	const presenceOptions = [
		{ value: 'FRIENDS', label: m.settings_privacy_value_friends() },
		{ value: 'FAVORITE_FRIENDS', label: m.settings_privacy_value_favorite() },
		{ value: 'SELF', label: m.settings_privacy_value_self() }
	];

	const playLogOptions = [
		{ value: 'EVERYONE', label: m.settings_privacy_value_everyone() },
		{ value: 'FRIENDS', label: m.settings_privacy_value_friends() },
		{ value: 'FAVORITE_FRIENDS', label: m.settings_privacy_value_favorite() },
		{ value: 'SELF', label: m.settings_privacy_value_self() }
	];

	async function save(
		type: 'presence' | 'play-log' | 'friend-request',
		value: unknown,
		rollback: () => void
	) {
		if (saving) return;

		saving = true;
		message = '';
		error = undefined;

		try {
			const response = await fetch('/api/nso/changePermissions', {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ type, value })
			});

			if (!response.ok) {
				throw await ReefError.fromResponse(response);
			}

			const data = (await response.json().catch(() => ({}))) as {
				userPermissions?: UserPermissionsSummary;
			};

			if (data.userPermissions) {
				presence = data.userPermissions.permissions.presence;
				playLog = data.userPermissions.permissions.playLog;
				friendRequests = data.userPermissions.permissions.friendRequestReception;
			}

			message = m.settings_privacy_saved();

			void invalidateAll();
		} catch (cause) {
			rollback();
			error = ReefError.from(cause);
		} finally {
			saving = false;
		}
	}
</script>

<section aria-labelledby="privacy-heading" id="privacy-controls">
	<header class="mb-3">
		<h2 id="privacy-heading" class="text-lg font-semibold">{m.settings_privacy_title()}</h2>
		<p class="mt-1 max-w-2xl text-sm opacity-65">
			{m.settings_privacy_subtitle()}
		</p>
	</header>

	{#if userPermissions == null}
		<div class="flex flex-col gap-4">
			<div class="alert items-start alert-info" role="alert">
				<CircleAlert class="size-5 shrink-0" aria-hidden="true" />
				<span>
					{m.settings_privacy_no_sync()}
				</span>
			</div>

			<button
				class="btn w-full btn-outline sm:w-auto"
				type="button"
				onclick={() => invalidateAll()}
			>
				{m.common_try_again()}
			</button>
		</div>
	{:else}
		<div class="overflow-hidden rounded-2xl border border-base-300 bg-base-200">
			<div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
				<span class="min-w-0 flex-1">
					<span class="block font-semibold">{m.settings_privacy_presence_heading()}</span>
					<span class="mt-0.5 block text-sm opacity-65">
						{m.settings_privacy_presence_subheading()}
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
					<span class="block font-semibold">{m.settings_privacy_play_heading()}</span>
					<span class="mt-0.5 block text-sm opacity-65">
						{m.settings_privacy_play_subheading()}
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
					<span class="block font-semibold">{m.settings_privacy_requests_heading()}</span>
					<span class="mt-0.5 block text-sm opacity-65">
						{m.settings_privacy_requests_subheading()}
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
		</div>

		{#if message}
			<p class="mt-5 text-sm text-success" aria-live="polite">{message}</p>
		{/if}

		{#if error}
			<p class="mt-5 text-sm text-error" aria-live="polite">{errorMessage(error)}</p>
		{/if}
	{/if}
</section>
