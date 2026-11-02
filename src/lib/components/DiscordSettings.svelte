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
	import { ParaglideMessage } from '@inlang/paraglide-js-svelte';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import { ReefError } from '$lib/types/errors';

	let {
		discordLink,
		presenceSession,
		visibleSystemBotInfo,
		userPermissions,
		discordEnrolmentsEnabled,
		systemBotCapacityAvailable = true,
		discordLinkError = null
	}: {
		discordLink?: DiscordLinkSummary;
		presenceSession?: PresenceSessionSummary;
		visibleSystemBotInfo?: VisibleSystemBotInfo | null;
		userPermissions?: UserPermissionsSummary | null;
		discordEnrolmentsEnabled: boolean;
		systemBotCapacityAvailable?: boolean;
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
	const botName = $derived(visibleSystemBotInfo?.name ?? m.settings_discord_system_user_fallback());

	const syncForm: SubmitFunction =
		() =>
		async ({ result, update }) => {
			message = '';

			if (result.type === 'error') {
				message = result.error ?? m.common_error_generic();
				return;
			}

			if (result.type === 'failure') {
				message = String(result.data?.message ?? m.common_error_generic());
				return;
			}

			await update({ invalidateAll: true });
		};

	function formatDate(value: Date) {
		return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium' }).format(value);
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

			if (!response.ok) {
				throw new ReefError('discord_error_generic')
			}

			const { authoriseURL } = await response.json();

			if (typeof authoriseURL !== 'string') {
				throw new ReefError('discord_error_generic')
			}

			window.location.href = authoriseURL;
		} catch (error) {
			message = error instanceof Error ? error.message : m.common_error_discord_generic();
			linking = false;
		}
	}

	const platformLabels: Record<ActivityPlatform, () => string> = {
		[ActivityPlatform.DESKTOP]: m.settings_discord_platform_desktop,
		[ActivityPlatform.XBOX]: m.settings_discord_platform_xbox,
		[ActivityPlatform.IOS]: m.settings_discord_platform_ios,
		[ActivityPlatform.EMBEDDED]: m.settings_discord_platform_embedded,
		[ActivityPlatform.PS5]: m.settings_discord_platform_ps5,
		[ActivityPlatform.META_QUEST]: m.settings_discord_platform_meta_quest
	};

	const activityPlatforms = Object.values(ActivityPlatform);

	function scrollToPrivacy() {
		document.getElementById('privacy-controls')?.scrollIntoView({ behavior: 'smooth' });
	}
</script>

<section aria-labelledby="discord-heading">
	<header class="mb-3">
		<h2 id="discord-heading" class="text-lg font-semibold">{m.settings_discord_title()}</h2>
		<p class="mt-1 max-w-2xl text-sm opacity-65">{m.settings_discord_subtitle()}</p>
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
					<p class="mt-0.5 text-sm opacity-65">
						{m.settings_discord_user_linked({ date: formatDate(discordLink.linkedAt) })}
					</p>
				</div>

				<button
					class="btn w-full btn-outline btn-error btn-sm sm:w-auto"
					type="button"
					onclick={() => (unlinkOpen = true)}
				>
					{m.settings_discord_button_unlink()}
				</button>
			</div>

			{#if presenceSession?.needsReauth}
				<div class="border-t border-base-300"></div>
				<div class="p-5">
					<div class="alert items-start alert-error" role="alert">
						<span>{m.settings_discord_error_reauth()}</span>
					</div>
				</div>
			{:else if presenceSession?.publishFailures}
				<div class="border-t border-base-300"></div>
				<div class="p-5">
					<div class="alert items-start alert-warning" role="alert">
						<span>{m.settings_discord_error_publish_failed()}</span>
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
						<span class="block font-semibold">{m.settings_discord_rpc_heading()}</span>
						<span class="mt-0.5 block text-sm opacity-65">
							{m.settings_discord_rpc_subheading()}
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
								<ParaglideMessage
									message={m.settings_discord_rpc_favorites_warning}
									inputs={{ botName }}
								>
									{#snippet strong({ children })}
										<strong>{@render children?.()}</strong>
									{/snippet}
								</ParaglideMessage>
							</span>

							<a
								class="btn btn-sm"
								role="button"
								href={resolve(`/friends?pop=${visibleSystemBotInfo?.nsaId}`)}
							>
								{m.settings_discord_rpc_favorites_warning_button()}
							</a>
						</div>
					</div>
				{:else if presenceSession?.enabled && userPermissions?.permissions.presence === 'SELF'}
					<div class="px-5 pb-5">
						<div class="alert items-center alert-error" role="alert">
							<CircleX class="size-5 shrink-0" aria-hidden="true" />
							<span>
								<ParaglideMessage message={m.settings_discord_rpc_self_warning} inputs={{ botName }}>
									{#snippet strong({ children })}
										<strong>{@render children?.()}</strong>
									{/snippet}
								</ParaglideMessage>
							</span>

							<button type="button" class="btn btn-sm" onclick={scrollToPrivacy}>
								{m.settings_discord_rpc_self_warning_button()}
							</button>
						</div>
					</div>
				{/if}
			</form>

			<div class="border-t border-base-300"></div>

			<form method="POST" action="?/setSync" use:enhance={syncForm}>
				<label class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
					<span class="min-w-0 flex-1">
						<span class="block font-semibold">{m.settings_discord_platform_heading()}</span>
						<span class="mt-0.5 block text-sm opacity-65">
							{m.settings_discord_platform_subheading()}
						</span>
					</span>

					<select
						class="select w-full sm:w-48"
						name="platform"
						value={presenceSession?.platform}
						onchange={(event) => event.currentTarget.form?.requestSubmit()}
					>
						{#each activityPlatforms as platform (platform)}
							<option value={platform}>{platformLabels[platform]()}</option>
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
							<span class="block font-semibold">{m.settings_discord_splatnet_heading()}</span>
							<span class="mt-0.5 block text-sm opacity-65">
								{m.settings_discord_splatnet_subheading()}
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
						<span class="block font-semibold">{m.settings_discord_inactive_heading()}</span>
						<span class="mt-0.5 block text-sm opacity-65">
							{m.settings_discord_inactive_subheading()}
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
						<span class="block font-semibold">{m.settings_discord_eshop_heading()}</span>
						<span class="mt-0.5 block text-sm opacity-65">
							{m.settings_discord_eshop_subheading()}
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
						<span class="block font-semibold">{m.settings_discord_friendcode_heading()}</span>
						<span class="mt-0.5 block text-sm opacity-65">
							{m.settings_discord_friendcode_subheading()}
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
					<p class="font-semibold">{m.settings_discord_presence_waiting_heading()}</p>
					<p class="mt-0.5 text-sm opacity-65">{m.settings_discord_presence_waiting_subheading()}</p>
				</div>
			{:else if presenceState === 'OFFLINE'}
				<div class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
					<img
						src={presence.user?.imageUri ?? avatarUrl(discordLink)}
						alt=""
						class="size-11 shrink-0 rounded-full bg-base-300 object-cover"
					/>

					<div class="min-w-0 flex-1">
						<p class="font-semibold">{m.settings_discord_presence_offline_heading()}</p>
						{#if presence.game}
							<p class="mt-0.5 text-sm opacity-65">
								{m.settings_discord_presence_offline_last_played({ game: presence.game.name })}
							</p>
						{/if}
						<p class="mt-0.5 text-sm opacity-65">
							{m.settings_discord_presence_offline_last_seen({ time: timeAgo(presence.logoutAt) })}
						</p>
					</div>

					<span class="badge badge-ghost">{m.settings_discord_presence_offline_badge()}</span>
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
						<p class="font-semibold">{m.settings_discord_presence_online_heading()}</p>
						<p class="mt-0.5 text-sm opacity-65">{m.settings_discord_presence_online_subheading()}</p>
					</div>

					<span class="badge badge-soft badge-success">{m.settings_discord_presence_online_badge()}</span>
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
						{m.settings_discord_unlinked_heading()}

						{#if !discordEnrolmentsEnabled}
							<span class="badge px-1 font-normal badge-error">
								{m.settings_discord_unlinked_badge_enrolment_disabled()}
							</span>
						{:else if !systemBotCapacityAvailable}
							<span class="badge px-1 font-normal badge-warning">
								{m.settings_discord_unlinked_badge_no_capacity()}
							</span>
						{/if}
					</p>
					<p class="mt-0.5 text-sm opacity-65">
						{#if !discordEnrolmentsEnabled || systemBotCapacityAvailable}
							{m.settings_discord_unlinked_subheading()}
						{:else}
							{m.settings_discord_unlinked_subheading_full()}
						{/if}
					</p>
				</div>

				<button
					class="btn w-full btn-primary sm:w-auto"
					type="button"
					onclick={linkAccount}
					disabled={linking || !discordEnrolmentsEnabled || !systemBotCapacityAvailable}
				>
					{linking ? m.settings_discord_button_link_loading() : m.settings_discord_button_link()}
				</button>
			</div>
		{/if}
	</div>

	{#if message}
		<p class="mt-5" aria-live="polite">{message}</p>
	{/if}

	<UnlinkDiscordModal bind:open={unlinkOpen} discordUsername={discordLink?.discordUsername} />
</section>
