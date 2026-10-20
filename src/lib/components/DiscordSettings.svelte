<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type {
		DiscordLinkSummary,
		PresenceSessionSummary,
		UserPermissionsSummary,
		VisibleSystemBotInfo
	} from '$lib/types/settings';
	import { formatPlayTime, timeAgo } from '$lib/utils/playTime';
	import { ActivityPlatform } from '$lib/types/discord-auth';
	import CircleX from '@lucide/svelte/icons/circle-x';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import UnlinkDiscordModal from './UnlinkDiscordModal.svelte';
	import { resolve } from '$app/paths';

	let {
		discordLink,
		presenceSession,
		visibleSystemBotInfo,
		userPermissions,
		discordEnrolmentsEnabled,
		discordLinkError = null
	}: {
		discordLink?: DiscordLinkSummary;
		presenceSession?: PresenceSessionSummary;
		visibleSystemBotInfo?: VisibleSystemBotInfo | null;
		userPermissions?: UserPermissionsSummary | null;
		discordEnrolmentsEnabled: boolean;
		discordLinkError?: string | null;
	} = $props();

	let unlinkOpen = $state(false);
	let linking = $state(false);
	let message = $state('');
	let enabledHidden = $state<HTMLInputElement>();
	let splatnetEnabledHidden = $state<HTMLInputElement>();
	let showWhenInactiveHidden = $state<HTMLInputElement>();
	let showEShopButtonHidden = $state<HTMLInputElement>();
	let showFriendCodeButtonHidden = $state<HTMLInputElement>();

	const presence = $derived(presenceSession?.presence);
	const presenceState = $derived<string | undefined>(presence?.state);

	const syncForm: SubmitFunction =
		() =>
		async ({ result, update }) => {
			message = '';

			if (result.type === 'error') {
				message = result.error ?? 'Something went wrong.';
				return;
			}

			if (result.type === 'failure') {
				message = String(result.data?.message ?? 'Something went wrong.');
				return;
			}

			await update({ invalidateAll: true });
		};

	function formatDate(value: Date) {
		return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(value);
	}

	function setHiddenFlag(input: HTMLInputElement | undefined, checked: boolean) {
		if (input) input.value = checked ? 'true' : 'false';
	}

	function avatarUrl(link: DiscordLinkSummary) {
		if (link.discordAvatar) {
			return `https://cdn.discordapp.com/avatars/${link.discordUserId}/${link.discordAvatar}.png?size=128`;
		}

		const index = Number((BigInt(link.discordUserId) >> 22n) % 6n);
		return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
	}

	async function linkAccount() {
		message = '';
		linking = true;

		try {
			const response = await fetch('/api/discord/generate-url');

			if (!response.ok) throw new Error('Could not start Discord linking.');

			const { authoriseURL } = await response.json();

			if (typeof authoriseURL !== 'string') {
				throw new Error('Discord returned an invalid authorisation URL.');
			}

			window.location.href = authoriseURL;
		} catch (error) {
			message = error instanceof Error ? error.message : 'Discord linking failed.';
			linking = false;
		}
	}

	const platformLabels: Record<ActivityPlatform, string> = {
		[ActivityPlatform.DESKTOP]: 'Desktop',
		[ActivityPlatform.XBOX]: 'Xbox',
		[ActivityPlatform.IOS]: 'iOS',
		[ActivityPlatform.EMBEDDED]: 'Generic Console',
		[ActivityPlatform.PS5]: 'PS5',
		[ActivityPlatform.META_QUEST]: 'Meta Quest'
	};

	const activityPlatforms = Object.values(ActivityPlatform).map((value) => ({
		value,
		label: platformLabels[value]
	}));

	function scrollToPrivacy() {
		document.getElementById('privacy-controls')?.scrollIntoView({ behavior: 'smooth' });
	}
</script>

<section aria-labelledby="discord-heading">
	<header class="mb-3">
		<h2 id="discord-heading" class="text-lg font-semibold">Discord</h2>
		<p class="mt-1 max-w-2xl text-sm opacity-65">Link a Discord account to share your presence.</p>
	</header>

	{#if discordLinkError}
		<div class="mb-3 alert items-start alert-error" role="alert">
			<CircleX class="size-5 shrink-0" aria-hidden="true" />
			<span>{discordLinkError}</span>
		</div>
	{/if}

	<div class="overflow-hidden rounded-2xl border border-base-300 bg-base-200">
		{#if discordLink}
			<div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
				<img
					src={avatarUrl(discordLink)}
					alt=""
					class="size-11 shrink-0 rounded-full bg-base-300 object-cover"
				/>

				<div class="min-w-0 flex-1">
					<p class="truncate font-semibold">{discordLink.discordUsername}</p>
					<p class="mt-0.5 text-sm opacity-65">Linked {formatDate(discordLink.linkedAt)}</p>
				</div>

				<button
					class="btn w-full btn-outline btn-error btn-sm sm:w-auto"
					type="button"
					onclick={() => (unlinkOpen = true)}
				>
					Unlink
				</button>
			</div>

			{#if presenceSession?.needsReauth}
				<div class="border-t border-base-300"></div>
				<div class="p-5">
					<div class="alert items-start alert-error" role="alert">
						<span>
							Reef has lost access to your Discord account, so Rich Presence has stopped. Unlink
							your account and link it again to restore it.
						</span>
					</div>
				</div>
			{:else if presenceSession?.publishFailures}
				<div class="border-t border-base-300"></div>
				<div class="p-5">
					<div class="alert items-start alert-warning" role="alert">
						<span>
							Reef is having trouble publishing your presence to Discord and will keep retrying. If
							this continues, unlink your account and link it again.
						</span>
					</div>
				</div>
			{/if}

			<div class="border-t border-base-300"></div>

			<form method="POST" action="?/setSync" use:enhance={syncForm}>
				<input
					type="hidden"
					name="enabled"
					value={presenceSession?.enabled ? 'true' : 'false'}
					bind:this={enabledHidden}
				/>

				<label class="flex items-center gap-4 p-5">
					<span class="min-w-0 flex-1">
						<span class="block font-semibold">Enable Discord Rich Presence</span>
						<span class="mt-0.5 block text-sm opacity-65">
							Keep your Discord status in sync with your Switch presence.
						</span>
					</span>

					<input
						type="checkbox"
						class="toggle toggle-primary"
						checked={presenceSession?.enabled ?? false}
						onchange={(event) => {
							setHiddenFlag(enabledHidden, event.currentTarget.checked);
							event.currentTarget.form?.requestSubmit();
						}}
					/>
				</label>

				{#if presenceSession?.enabled && userPermissions?.permissions.presence === 'FAVORITE_FRIENDS'}
					<div class="px-5 pb-5">
						<div class="alert items-center alert-warning" role="alert">
							<TriangleAlert class="size-5 shrink-0" aria-hidden="true" />
							<span>
								Your presence is set to <strong>Best Friends only</strong>. Make sure
								{visibleSystemBotInfo?.name ?? 'the system user'} is marked as a Best Friend, otherwise
								your games won't show on Discord.
							</span>

							<a
								class="btn btn-sm"
								role="button"
								href={resolve(`/friends?pop=${visibleSystemBotInfo?.nsaId}`)}>Add as Best Friend</a
							>
						</div>
					</div>
				{:else if presenceSession?.enabled && userPermissions?.permissions.presence === 'SELF'}
					<div class="px-5 pb-5">
						<div class="alert items-center alert-error" role="alert">
							<CircleX class="size-5 shrink-0" aria-hidden="true" />
							<span>
								Your presence is set to <strong>No One</strong>, so
								{visibleSystemBotInfo?.name ?? 'the system user'} can't see you and Discord Rich Presence
								won't work. Change it to <strong>Friends</strong> or
								<strong>Best Friends</strong>.
							</span>

							<button type="button" class="btn btn-sm" onclick={scrollToPrivacy}
								>Let's change it!</button
							>
						</div>
					</div>
				{/if}
			</form>

			<div class="border-t border-base-300"></div>

			<form method="POST" action="?/setSync" use:enhance={syncForm}>
				<label class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
					<span class="min-w-0 flex-1">
						<span class="block font-semibold"> Discord Platform Appearance </span>
						<span class="mt-0.5 block text-sm opacity-65">
							Choose what platform your activity appears from.
						</span>
					</span>

					<select
						class="select w-full sm:w-48"
						name="platform"
						value={presenceSession?.platform}
						onchange={(event) => event.currentTarget.form?.requestSubmit()}
					>
						{#each activityPlatforms as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</label>
			</form>

			<div class="border-t border-base-300"></div>

			{#if visibleSystemBotInfo?.webServices.splatnet3}
				<form method="POST" action="?/setSync" use:enhance={syncForm}>
					<input
						type="hidden"
						name="splatnetEnabled"
						value={presenceSession?.splatnetEnabled ? 'true' : 'false'}
						bind:this={splatnetEnabledHidden}
					/>

					<div class="flex items-center gap-4 p-5">
						<span class="min-w-0 flex-1">
							<span class="block font-semibold"> Enable SplatNet 3 Enhanced Rich Presence </span>
							<span class="mt-0.5 block text-sm opacity-65">
								Uses SplatNet 3 to retrieve additonal presence information while playing Splatoon 3.
							</span>
						</span>

						<input
							type="checkbox"
							class="toggle toggle-primary"
							checked={presenceSession?.splatnetEnabled ?? false}
							onchange={(event) => {
								setHiddenFlag(splatnetEnabledHidden, event.currentTarget.checked);
								event.currentTarget.form?.requestSubmit();
							}}
						/>
					</div>

					<div class="border-t border-base-300"></div>
				</form>
			{/if}

			<form method="POST" action="?/setSync" use:enhance={syncForm}>
				<input
					type="hidden"
					name="showWhenInactive"
					value={presenceSession?.showWhenInactive ? 'true' : 'false'}
					bind:this={showWhenInactiveHidden}
				/>

				<div class="flex items-center gap-4 p-5">
					<span class="min-w-0 flex-1">
						<span class="block font-semibold"> Show activity while inactive </span>
						<span class="mt-0.5 block text-sm opacity-65">
							Keep an "Online" activity on Discord while you're on your Switch but not playing
							anything.
						</span>
					</span>

					<input
						type="checkbox"
						class="toggle toggle-primary"
						checked={presenceSession?.showWhenInactive ?? false}
						onchange={(event) => {
							setHiddenFlag(showWhenInactiveHidden, event.currentTarget.checked);
							event.currentTarget.form?.requestSubmit();
						}}
					/>
				</div>
			</form>

			<div class="border-t border-base-300"></div>

			<form method="POST" action="?/setSync" use:enhance={syncForm}>
				<input
					type="hidden"
					name="showEShopButton"
					value={presenceSession?.showEShopButton ? 'true' : 'false'}
					bind:this={showEShopButtonHidden}
				/>

				<div class="flex items-center gap-4 p-5">
					<span class="min-w-0 flex-1">
						<span class="block font-semibold"> Show eShop button </span>
						<span class="mt-0.5 block text-sm opacity-65">
							Add a "View on the eShop" button to your activity.
						</span>
					</span>

					<input
						type="checkbox"
						class="toggle toggle-primary"
						checked={presenceSession?.showEShopButton ?? true}
						onchange={(event) => {
							setHiddenFlag(showEShopButtonHidden, event.currentTarget.checked);
							event.currentTarget.form?.requestSubmit();
						}}
					/>
				</div>
			</form>

			<div class="border-t border-base-300"></div>

			<form method="POST" action="?/setSync" use:enhance={syncForm}>
				<input
					type="hidden"
					name="showFriendCodeButton"
					value={presenceSession?.showFriendCodeButton ? 'true' : 'false'}
					bind:this={showFriendCodeButtonHidden}
				/>

				<div class="flex items-center gap-4 p-5">
					<span class="min-w-0 flex-1">
						<span class="block font-semibold"> Show Friend Code button </span>
						<span class="mt-0.5 block text-sm opacity-65">
							Add a "Send Friend Request" button linking to your friend code.
						</span>
					</span>

					<input
						type="checkbox"
						class="toggle toggle-primary"
						checked={presenceSession?.showFriendCodeButton ?? false}
						onchange={(event) => {
							setHiddenFlag(showFriendCodeButtonHidden, event.currentTarget.checked);
							event.currentTarget.form?.requestSubmit();
						}}
					/>
				</div>
			</form>

			<div class="border-t border-base-300"></div>

			{#if !presenceSession?.enabled}
				<div></div>
			{:else if presence == null}
				<div class="p-5">
					<p class="font-semibold">Waiting for presence</p>
					<p class="mt-0.5 text-sm opacity-65">Your Switch presence will show up here shortly.</p>
				</div>
			{:else if presenceState === 'OFFLINE'}
				<div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
					<img
						src={presence.user?.imageUri ?? avatarUrl(discordLink)}
						alt=""
						class="size-11 shrink-0 rounded-full bg-base-300 object-cover"
					/>

					<div class="min-w-0 flex-1">
						<p class="font-semibold">Offline</p>
						{#if presence.game}
							<p class="mt-0.5 text-sm opacity-65">Last played {presence.game.name}</p>
						{/if}
						<p class="mt-0.5 text-sm opacity-65">Last seen {timeAgo(presence.logoutAt)}</p>
					</div>

					<span class="badge badge-ghost">Offline</span>
				</div>
			{:else if presence.game}
				<div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
					<img
						src={presence.game.imageUri}
						alt=""
						class="size-22 shrink-0 rounded-lg bg-base-300 object-cover"
					/>

					<div class="min-w-0 flex-1">
						<p class="truncate font-semibold">{presence.game.name}</p>
						<p class="mt-0.5 text-sm opacity-65">
							{formatPlayTime(presence.game.totalPlayTime, presence.game.firstPlayedAt)}
						</p>
					</div>
				</div>
			{:else}
				<div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
					<img
						src={avatarUrl(discordLink)}
						alt=""
						class="size-22 shrink-0 rounded-full bg-base-300 object-cover"
					/>

					<div class="min-w-0 flex-1">
						<p class="font-semibold">Online</p>
						<p class="mt-0.5 text-sm opacity-65">On their Switch right now</p>
					</div>

					<span class="badge badge-soft badge-success">Online</span>
				</div>
			{/if}
		{:else}
			<div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
				<div
					class="grid size-11 shrink-0 place-items-center rounded-full bg-[#5865F2]/15 text-[#5865F2]"
				>
					<svg viewBox="0 0 24 24" class="size-6" fill="currentColor" aria-hidden="true">
						<path
							d="M20.317 4.3698a19.7913 19.7913 0 0 0-4.8851-1.5152.0741.0741 0 0 0-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 0 0-.0785-.037 19.7363 19.7363 0 0 0-4.8852 1.515.0699.0699 0 0 0-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 0 0 .0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 0 0 .0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 0 0-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 0 1-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 0 1 .0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 0 1 .0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 0 1-.0066.1276 12.2986 12.2986 0 0 1-1.873.8914.0766.0766 0 0 0-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 0 0 .0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 0 0 .0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 0 0-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"
						/>
					</svg>
				</div>

				<div class="min-w-0 flex-1">
					<p class="font-semibold">
						No Discord account linked

						{#if !discordEnrolmentsEnabled}
							<span class="badge px-1 font-normal badge-error"
								>Enrolment is currently disabled.</span
							>
						{/if}
					</p>
					<p class="mt-0.5 text-sm opacity-65">
						Connect a Discord account to enable Discord features.
					</p>
				</div>

				<button
					class="btn w-full btn-primary sm:w-auto"
					type="button"
					onclick={linkAccount}
					disabled={linking || !discordEnrolmentsEnabled}
				>
					{linking ? 'Redirecting...' : 'Link Discord account'}
				</button>
			</div>
		{/if}
	</div>

	{#if message}
		<p class="mt-5" aria-live="polite">{message}</p>
	{/if}

	<UnlinkDiscordModal bind:open={unlinkOpen} discordUsername={discordLink?.discordUsername} />
</section>
