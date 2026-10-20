<script lang="ts">
	import AccountSettings from '$lib/components/AccountSettings.svelte';
	import AdminSettings from '$lib/components/AdminSettings.svelte';
	import DataAccessLogsSettings from '$lib/components/DataAccessLogsSettings.svelte';
	import DiscordSettings from '$lib/components/DiscordSettings.svelte';
	import PasskeySettings from '$lib/components/PasskeySettings.svelte';
	import PrivacySettings from '$lib/components/PrivacySettings.svelte';
	import type {
		DataAccessLogSummary,
		DiscordLinkSummary,
		PasskeySummary,
		PresenceSessionSummary,
		SiteSettingsSummary,
		UserPermissionsSummary,
		VisibleSystemBotInfo
	} from '$lib/types/settings';
	import { appInfo } from '$lib/version';

	let {
		passkeys,
		discordLink,
		presenceSession,
		dataAccessLogs,
		visibleSystemBotInfo,
		isAdmin = false,
		adminSettings = null,
		discordInviteLink = 'https://discord.gg/bmCyVeF6Vw',
		userPermissions,
		discordEnrolmentsEnabled,
		discordLinkError = null
	}: {
		passkeys: PasskeySummary[];
		discordLink?: DiscordLinkSummary;
		presenceSession?: PresenceSessionSummary;
		dataAccessLogs: DataAccessLogSummary[];
		visibleSystemBotInfo?: VisibleSystemBotInfo | null;
		isAdmin?: boolean;
		adminSettings?: SiteSettingsSummary | null;
		discordInviteLink?: string;
		userPermissions?: UserPermissionsSummary | null;
		discordEnrolmentsEnabled: boolean;
		discordLinkError?: string | null;
	} = $props();

	const supporters: string[] = ['Azteea', 'mia', 'Kiarocki', 'Dycool', 'FloGamer64', 'NakuKoro', 'nekeo'];
</script>

<div class="w-full py-8 sm:py-10">
	<header class="border-b border-base-300 pb-8">
		<h1 class="mt-1 text-3xl font-bold sm:text-4xl">Settings</h1>
		<p class="mt-3 max-w-2xl opacity-70">Manage sign-in methods and your current session.</p>
	</header>

	<div class="mt-8 space-y-8">
		<PasskeySettings {passkeys} />
		<DiscordSettings
			{discordLink}
			{presenceSession}
			{visibleSystemBotInfo}
			{userPermissions}
			{discordEnrolmentsEnabled}
			{discordLinkError}
		/>
		<PrivacySettings {userPermissions} />
		<DataAccessLogsSettings {dataAccessLogs} />
		<AccountSettings {visibleSystemBotInfo} />
		{#if isAdmin}
			<AdminSettings {adminSettings} />
		{/if}
	</div>

	<div class="mt-8">
		<p class="text-xs opacity-65">
			{appInfo.commit} - {new Date(appInfo.buildTime).toLocaleString('en-NZ', {
				timeZone: 'Pacific/Auckland',
				day: 'numeric',
				month: 'short',
				year: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
				timeZoneName: 'short'
			})}
			<br /><br />
			Made with 💛 by Ben
			<br /><br />
			Big thanks to dootskyre for creating the Reef icon, and for all her feedback. Check her out on
			<a href="https://bsky.app/profile/dootsky.re" target="_blank" class="link link-primary"
				>Bluesky</a
			>.
			<br /><br />
			And of course, thanks to my
			<a href="https://github.com/sponsors/bentheminernz" target="_blank" class="link"
				>GitHub Sponsors</a
			>: {supporters.join(', ')}
			<br /><br />
			<span class="flex flex-row gap-2 align-middle">
				<a aria-label="Twitter Link" href="https://twitter.com/idocode01" target="_blank">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						fill="currentColor"
						class="bi bi-twitter"
						viewBox="0 0 16 16"
					>
						<path
							d="M5.026 15c6.038 0 9.341-5.003 9.341-9.334q.002-.211-.006-.422A6.7 6.7 0 0 0 16 3.542a6.7 6.7 0 0 1-1.889.518 3.3 3.3 0 0 0 1.447-1.817 6.5 6.5 0 0 1-2.087.793A3.286 3.286 0 0 0 7.875 6.03a9.32 9.32 0 0 1-6.767-3.429 3.29 3.29 0 0 0 1.018 4.382A3.3 3.3 0 0 1 .64 6.575v.045a3.29 3.29 0 0 0 2.632 3.218 3.2 3.2 0 0 1-.865.115 3 3 0 0 1-.614-.057 3.28 3.28 0 0 0 3.067 2.277A6.6 6.6 0 0 1 .78 13.58a6 6 0 0 1-.78-.045A9.34 9.34 0 0 0 5.026 15"
						/>
					</svg>
				</a>

				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a aria-label="Discord Invite" href={discordInviteLink} target="_blank">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						fill="currentColor"
						class="bi bi-discord"
						viewBox="0 0 16 16"
					>
						<path
							d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8 8 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032q.003.022.021.037a13.3 13.3 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019q.463-.63.818-1.329a.05.05 0 0 0-.01-.059l-.018-.011a9 9 0 0 1-1.248-.595.05.05 0 0 1-.02-.066l.015-.019q.127-.095.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.007q.121.1.248.195a.05.05 0 0 1-.004.085 8 8 0 0 1-1.249.594.05.05 0 0 0-.03.03.05.05 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.2 13.2 0 0 0 4.001-2.02.05.05 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.03.03 0 0 0-.02-.019m-8.198 7.307c-.789 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612m5.316 0c-.788 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612"
						/>
					</svg>
				</a>

				<a aria-label="GitHub" href="https://github.com/bentheminernz" target="_blank">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						fill="currentColor"
						class="bi bi-github"
						viewBox="0 0 16 16"
					>
						<path
							d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8"
						/>
					</svg>
				</a>

				<a
					class="transition-colors duration-150 hover:text-red-700"
					aria-label="GitHub Sponsor"
					href="https://github.com/sponsors/bentheminernz"
					target="_blank"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						fill="currentColor"
						class="bi bi-heart-fill"
						viewBox="0 0 16 16"
					>
						<path
							fill-rule="evenodd"
							d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314"
						/>
					</svg>
				</a>
			</span>
		</p>
	</div>
</div>
