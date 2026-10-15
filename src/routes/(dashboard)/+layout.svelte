<!-- just a wee warning that i **suck** at UI and this is some of the worst code ive ever written
    and some of the assets required in this app come from the Nintendo Switch App so they are
    unavailable in the source code and you will need to dump them for it to work
-->
<script lang="ts">
	import album_dark_off from '$lib/assets/lottie/album_dark_off.json';
	import album_dark_on from '$lib/assets/lottie/album_dark_on.json';
	import home_dark_off from '$lib/assets/lottie/home_dark_off.json';
	import home_dark_on from '$lib/assets/lottie/home_dark_on.json';
	import friend_dark_off from '$lib/assets/lottie/friend_dark_off.json';
	import friend_dark_on from '$lib/assets/lottie/friend_dark_on.json';

	import album_light_off from '$lib/assets/lottie/album_light_off.json';
	import album_light_on from '$lib/assets/lottie/album_light_on.json';
	import home_light_off from '$lib/assets/lottie/home_light_off.json';
	import home_light_on from '$lib/assets/lottie/home_light_on.json';
	import friend_light_off from '$lib/assets/lottie/friend_light_off.json';
	import friend_light_on from '$lib/assets/lottie/friend_light_on.json';

	import albumDarkOffIcon from '$lib/assets/icons/album_dark_off.svg';
	import albumDarkOnIcon from '$lib/assets/icons/album_dark_on.svg';
	import albumLightOffIcon from '$lib/assets/icons/album_light_off.svg';
	import albumLightOnIcon from '$lib/assets/icons/album_light_on.svg';
	import friendDarkOffIcon from '$lib/assets/icons/friend_dark_off.svg';
	import friendDarkOnIcon from '$lib/assets/icons/friend_dark_on.svg';
	import friendLightOffIcon from '$lib/assets/icons/friend_light_off.svg';
	import friendLightOnIcon from '$lib/assets/icons/friend_light_on.svg';
	import homeDarkOffIcon from '$lib/assets/icons/home_dark_off.svg';
	import homeDarkOnIcon from '$lib/assets/icons/home_dark_on.svg';
	import homeLightOffIcon from '$lib/assets/icons/home_light_off.svg';
	import homeLightOnIcon from '$lib/assets/icons/home_light_on.svg';

	import lottie, { type AnimationItem } from 'lottie-web/build/player/lottie_light';
	import { goto, invalidate, preloadData } from '$app/navigation';
	import { page } from '$app/state';
	import { onDestroy, onMount, tick } from 'svelte';
	import { fly } from 'svelte/transition';
	import { resolve } from '$app/paths';
	import type { LayoutProps } from './$types';
	import SettingsPage from '$lib/components/SettingsPage.svelte';
	import SignupBlockedModal from '$lib/components/SignupBlockedModal.svelte';
	import RequiredNoticeModal from '$lib/components/RequiredNoticeModal.svelte';
	import TabIcon from '$lib/components/TabIcon.svelte';
	import ReefIcon from '$lib/assets/ReefIcon.svg';

	import Bell from '@lucide/svelte/icons/bell';
	import NotificationsPage from '$lib/components/NotificationsPage.svelte';
	import {
		browserSupportsWebAuthn,
		platformAuthenticatorIsAvailable,
		startRegistration
	} from '@simplewebauthn/browser';

	type TabName = 'home' | 'friends' | 'album';

	const panels = ['settings', 'notifications'] as const;
	type PanelName = (typeof panels)[number];

	const routeNameToTab = (routeId: string | null): TabName | undefined => {
		if (panels.some((panel) => routeId?.includes(`/${panel}`))) return undefined;
		if (routeId?.includes('/friends')) return 'friends';
		if (routeId?.includes('/album')) return 'album';
		return 'home';
	};

	let { children, data }: LayoutProps = $props();

	let selectedTab = $state<TabName>(routeNameToTab(page.route.id) ?? 'home');
	let changingTab = $state(false);

	const panelName = $derived<PanelName | null>(
		panels.find((panel) => page.route.id?.includes(`/${panel}`)) ?? null
	);
	let panelOrigin = $state<TabName | null>(null);

	const pendingAckNotice = $derived(
		data.notices.find((notice) => notice.requireAcknowledgement && !notice.acknowledged)
	);

	$effect(() => {
		const routeTab = routeNameToTab(page.route.id);
		if (routeTab) selectedTab = routeTab;
	});

	let isLightMode = $state(false);

	$effect(() => {
		if (typeof window === 'undefined' || !window.matchMedia) return;
		const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
		const handler = (e: MediaQueryListEvent) => (isLightMode = e.matches);
		isLightMode = mediaQuery.matches;
		mediaQuery.addEventListener('change', handler);
		return () => mediaQuery.removeEventListener('change', handler);
	});

	const animationData = $derived<Record<TabName, object>>({
		home:
			selectedTab === 'home'
				? isLightMode
					? home_light_on
					: home_dark_on
				: isLightMode
					? home_light_off
					: home_dark_off,
		friends:
			selectedTab === 'friends'
				? isLightMode
					? friend_light_on
					: friend_dark_on
				: isLightMode
					? friend_light_off
					: friend_dark_off,
		album:
			selectedTab === 'album'
				? isLightMode
					? album_light_on
					: album_dark_on
				: isLightMode
					? album_light_off
					: album_dark_off
	});

	const staticIcons = $derived({
		home: {
			dark: selectedTab === 'home' ? homeDarkOnIcon : homeDarkOffIcon,
			light: selectedTab === 'home' ? homeLightOnIcon : homeLightOffIcon
		},
		friends: {
			dark: selectedTab === 'friends' ? friendDarkOnIcon : friendDarkOffIcon,
			light: selectedTab === 'friends' ? friendLightOnIcon : friendLightOffIcon
		},
		album: {
			dark: selectedTab === 'album' ? albumDarkOnIcon : albumDarkOffIcon,
			light: selectedTab === 'album' ? albumLightOnIcon : albumLightOffIcon
		}
	});

	let homeContainer = $state<HTMLDivElement>();
	let friendContainer = $state<HTMLDivElement>();
	let albumContainer = $state<HTMLDivElement>();

	const anims: Record<TabName, AnimationItem | undefined> = {
		home: undefined,
		friends: undefined,
		album: undefined
	};
	const loadedData: Record<TabName, object | undefined> = {
		home: undefined,
		friends: undefined,
		album: undefined
	};
	let renderedTabs = $state<Record<TabName, boolean>>({
		home: false,
		friends: false,
		album: false
	});

	function syncAnim(tab: TabName, container: HTMLDivElement | undefined, data: object) {
		if (!container) {
			if (anims[tab]) {
				anims[tab].destroy();
				anims[tab] = undefined;
				loadedData[tab] = undefined;
				renderedTabs[tab] = false;
			}
			return;
		}
		if (loadedData[tab] === data) return;
		anims[tab]?.destroy();
		const newAnim = lottie.loadAnimation({
			container,
			renderer: 'svg',
			loop: false,
			autoplay: false,
			animationData: data
		});
		newAnim.addEventListener('complete', () => onAnimationComplete(tab));
		newAnim.addEventListener('DOMLoaded', () => {
			if (anims[tab] === newAnim) renderedTabs[tab] = true;
		});
		newAnim.goToAndStop(newAnim.totalFrames - 1, true);
		anims[tab] = newAnim;
		loadedData[tab] = data;
	}

	$effect(() => {
		syncAnim('home', homeContainer, animationData.home);
		syncAnim('friends', friendContainer, animationData.friends);
		syncAnim('album', albumContainer, animationData.album);
	});

	onMount(async () => {
		if (data.passkeys.length === 0 && !passkeyPromptDismissed()) {
			await addPasskey();
		}
	});

	onDestroy(() => {
		anims.home?.destroy();
		anims.friends?.destroy();
		anims.album?.destroy();
	});

	async function selectTab(tabName: TabName) {
		const previousTab = selectedTab;
		if (changingTab) return;

		if (previousTab === tabName && routeNameToTab(page.route.id) === tabName) return;

		const destination =
			tabName === 'home'
				? resolve('/')
				: tabName === 'friends'
					? resolve('/friends')
					: resolve('/album');

		void preloadData(destination);

		changingTab = true;
		selectedTab = tabName;

		await tick();
		for (const tab of [previousTab, tabName]) {
			anims[tab]?.goToAndStop(0, true);
			anims[tab]?.play();
		}

		try {
			if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
				await new Promise((resolve) => setTimeout(resolve, 150));
			}

			await goto(destination);
			await tick();
		} finally {
			changingTab = false;
		}
	}

	function openPanel(name: PanelName) {
		if (panelName === name) {
			closePanel();
			return;
		}

		panelOrigin = routeNameToTab(page.route.id) ?? 'home';
		goto(resolve(`/${name}`));
	}

	function closePanel() {
		const tab = panelOrigin ?? 'home';

		goto(
			tab === 'home' ? resolve('/') : tab === 'friends' ? resolve('/friends') : resolve('/album')
		);
	}

	$effect(() => {
		if (panelName == null) return;

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		return () => {
			document.body.style.overflow = previousOverflow;
		};
	});

	$effect(() => {
		if (!data.signupBlocked) return;

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		return () => {
			document.body.style.overflow = previousOverflow;
		};
	});

	function onAnimationComplete(tabName: TabName) {
		if (selectedTab !== tabName) return;
		const anim = anims[tabName];
		if (anim) {
			anim.goToAndStop(anim.totalFrames - 1, true);
		}
	}

	const PASSKEY_PROMPT_COOKIE = 'passkey_prompt_dismissed';
	const PASSKEY_PROMPT_DISMISS_SECONDS = 7 * 24 * 60 * 60;

	function passkeyPromptDismissed(): boolean {
		return document.cookie
			.split(';')
			.some((cookie) => cookie.trim().startsWith(`${PASSKEY_PROMPT_COOKIE}=`));
	}

	function dismissPasskeyPrompt() {
		const secure = location.protocol === 'https:' ? '; secure' : '';

		document.cookie = `${PASSKEY_PROMPT_COOKIE}=1; max-age=${PASSKEY_PROMPT_DISMISS_SECONDS}; path=/; samesite=lax${secure}`;
	}

	let passkeyRegistering = $state(false);

	async function addPasskey() {
		if (passkeyRegistering) return;

		passkeyRegistering = true;

		try {
			if (!window.isSecureContext || !browserSupportsWebAuthn()) {
				return;
			}

			const optionsResponse = await fetch('/api/passkeys/registration/options', {
				method: 'POST'
			});

			if (!optionsResponse.ok) throw new Error('Could not start passkey registration');

			const optionsJSON = await optionsResponse.json();
			const response = await startRegistration({ optionsJSON });
			const verificationResponse = await fetch('/api/passkeys/registration/verify', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(response)
			});

			if (!verificationResponse.ok) {
				const body = await verificationResponse.text();
				throw new Error(`Passkey registration failed (${verificationResponse.status}): ${body}`);
			}

			await invalidate('app:passkeys');
		} catch (error) {
			if (error instanceof Error && error.name === 'NotAllowedError') {
				dismissPasskeyPrompt();
				return;
			}

			console.error('An error occurred during passkey registration', error);
		} finally {
			passkeyRegistering = false;
		}
	}
</script>

<header class="flex items-center justify-between">
	<div
		class="z-40 flex max-w-56 items-center gap-2 rounded-full bg-red-600 p-1.5 pr-2 text-white shadow-md ring-1 ring-base-300"
	>
		<img src={ReefIcon} alt="" class="size-6" />
		<h1 class="font-semibold">Reef</h1>
	</div>

	<div class="flex flex-row space-x-4">
		<button
			type="button"
			onclick={() => openPanel('notifications')}
			aria-label="Open the Notifications Panel"
			class="z-40 grid cursor-pointer place-items-center rounded-full bg-base-200 p-1.5 shadow-md ring-1 ring-base-300 transition active:scale-95"
		>
			{#await data.notifications}
				<span class="grid size-10 place-items-center rounded-full sm:size-12">
					<Bell class="size-7 sm:size-8" />
				</span>
			{:then notifications}
				{@const hasUnread =
					notifications.some((n) => !n.hasRead) ||
					data.notices.some((n) => n.requireAcknowledgement && !n.acknowledged)}
				<span class="grid size-10 place-items-center rounded-full sm:size-12">
					{#if hasUnread}
						<svg
							aria-hidden="true"
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="size-7 sm:size-8"
						>
							<path d="M10.268 21a2 2 0 0 0 3.464 0" />
							<path
								d="M11.68 2.009A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673c-.824-.85-1.678-1.731-2.21-3.348"
							/>
							<circle cx="18" cy="5" r="3" fill="currentColor" class="text-error" />
						</svg>
					{:else}
						<Bell class="size-7 sm:size-8" />
					{/if}
				</span>
			{:catch}
				<span class="grid size-10 place-items-center rounded-full sm:size-12">
					<Bell class="size-7 sm:size-8" />
				</span>
			{/await}
		</button>

		{#await data.userInfo}
			<div
				class="h-12 w-36 animate-pulse rounded-full bg-base-300 sm:h-14 sm:w-44"
				aria-hidden="true"
			></div>
		{:then user}
			<button
				type="button"
				onclick={() => openPanel('settings')}
				aria-label={`Open settings for ${user.name}`}
				class="z-40 flex max-w-56 cursor-pointer items-center gap-2 rounded-full bg-base-200 p-1.5 pr-4 shadow-md ring-1 ring-base-300 transition active:scale-95"
			>
				<img
					src={user.imageUri}
					alt=""
					class="size-10 shrink-0 rounded-full bg-base-300 object-cover sm:size-12"
				/>
				<span class="truncate text-sm font-semibold sm:text-base">{user.name}</span>
			</button>
		{/await}
	</div>
</header>

<div class="relative min-h-[calc(100dvh-5rem)] overflow-hidden">
	<div class="dashboard-content pb-32 sm:pb-40 lg:pb-48" class:tab-changing={changingTab}>
		{@render children?.()}
	</div>

	{#if panelName === 'settings'}
		<div
			class="slide-over-panel absolute inset-0 z-20 max-h-[calc(100dvh-5rem)] overflow-y-auto bg-base-100 pb-32 sm:pb-40 lg:pb-48"
			transition:fly={{ x: '100%', duration: 280 }}
		>
			<SettingsPage
				passkeys={data.passkeys}
				discordLink={data.discordLink}
				presenceSession={data.presenceSession}
				dataAccessLogs={data.dataAccessLogs}
				visibleSystemBotInfo={data.visibleSystemBotInfo}
				isAdmin={data.isAdmin}
				adminSettings={data.adminSettings}
				userPermissions={data.userPermissions}
				discordEnrolmentsEnabled={data.discordEnrolmentEnabled}
				discordLinkError={data.discordLinkError}
			/>
		</div>
	{/if}

	{#if panelName === 'notifications'}
		<div
			class="slide-over-panel absolute inset-0 z-20 max-h-[calc(100dvh-5rem)] overflow-y-auto bg-base-100 pb-32 sm:pb-40 lg:pb-48"
			transition:fly={{ x: '100%', duration: 280 }}
		>
			{#await data.notifications}
				<div class="grid place-items-center py-16" aria-hidden="true">
					<span class="loading loading-lg loading-spinner"></span>
				</div>
			{:then notifications}
				<NotificationsPage {notifications} coralSvelteNotices={data.notices} />
			{:catch error}
				<p class="py-8 opacity-70">Failed to load news: {error.message}</p>
			{/await}
		</div>
	{/if}
</div>

<div
	class="fixed bottom-2 left-1/2 z-30 flex w-[calc(100%-1rem)] -translate-x-1/2 transform flex-row items-center justify-between gap-1 rounded-full bg-nintendo-bg-light/60 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur-[2px] sm:bottom-6 sm:w-auto sm:min-w-md sm:gap-4 sm:px-6 sm:pb-2 lg:bottom-10 lg:min-w-64 lg:gap-8 lg:px-8 dark:bg-nintendo-bg-dark/70"
>
	<button
		type="button"
		aria-label="Home"
		aria-current={selectedTab === 'home' ? 'page' : undefined}
		class="flex min-w-0 flex-1 cursor-pointer flex-col items-center rounded-full px-1 transition-all duration-300 hover:scale-102 hover:bg-nintendo-home-light/20 active:scale-95 sm:flex-none sm:px-3 lg:px-4 dark:hover:bg-nintendo-home-dark/20"
		onclick={() => selectTab('home')}
		onpointerenter={() => preloadData(resolve('/'))}
	>
		<div class="relative size-16 lg:size-20">
			{#if data.allowAssets}
				<div class="lottie-container absolute inset-0" bind:this={homeContainer}></div>
				<picture class="pointer-events-none absolute inset-0" class:hidden={renderedTabs.home}>
					<source media="(prefers-color-scheme: light)" srcset={staticIcons.home.light} />
					<img class="size-full" src={staticIcons.home.dark} alt="" />
				</picture>
			{:else}
				<TabIcon tab="home" active={selectedTab === 'home'} />
			{/if}
		</div>
	</button>

	<button
		type="button"
		aria-label="Friends"
		aria-current={selectedTab === 'friends' ? 'page' : undefined}
		class="flex min-w-0 flex-1 cursor-pointer flex-col items-center rounded-full px-1 transition-all duration-300 hover:scale-102 hover:bg-nintendo-friends-light/20 active:scale-95 sm:flex-none sm:px-3 lg:px-4 dark:hover:bg-nintendo-friends-dark/20"
		onclick={() => selectTab('friends')}
		onpointerenter={() => preloadData(resolve('/friends'))}
	>
		<div class="relative size-16 lg:size-20">
			{#if data.allowAssets}
				<div class="lottie-container absolute inset-0" bind:this={friendContainer}></div>
				<picture class="pointer-events-none absolute inset-0" class:hidden={renderedTabs.friends}>
					<source media="(prefers-color-scheme: light)" srcset={staticIcons.friends.light} />
					<img class="size-full" src={staticIcons.friends.dark} alt="" />
				</picture>
			{:else}
				<TabIcon tab="friends" active={selectedTab === 'friends'} />
			{/if}
		</div>
	</button>

	<button
		type="button"
		aria-label="Album"
		aria-current={selectedTab === 'album' ? 'page' : undefined}
		class="flex min-w-0 flex-1 cursor-pointer flex-col items-center rounded-full px-1 transition-all duration-300 hover:scale-102 hover:bg-nintendo-album-light/20 active:scale-95 sm:flex-none sm:px-3 lg:px-4 dark:hover:bg-nintendo-album-dark/20"
		onclick={() => selectTab('album')}
		onpointerenter={() => preloadData(resolve('/album'))}
	>
		<div class="relative size-16 lg:size-20">
			{#if data.allowAssets}
				<div class="lottie-container absolute inset-0" bind:this={albumContainer}></div>
				<picture class="pointer-events-none absolute inset-0" class:hidden={renderedTabs.album}>
					<source media="(prefers-color-scheme: light)" srcset={staticIcons.album.light} />
					<img class="size-full" src={staticIcons.album.dark} alt="" />
				</picture>
			{:else}
				<TabIcon tab="album" active={selectedTab === 'album'} />
			{/if}
		</div>
	</button>
</div>

{#if data.signupBlocked}
	<SignupBlockedModal reason={data.signupBlockedReason} linked={data.discordLink != null} />
{/if}

{#if pendingAckNotice}
	<RequiredNoticeModal notice={pendingAckNotice} />
{/if}

<style>
	.dashboard-content {
		transform-origin: center center;
		transition:
			transform 160ms ease-out,
			opacity 140ms ease-out;
	}

	.dashboard-content.tab-changing {
		transform: scale(0.97);
		opacity: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.dashboard-content {
			transition: none;
		}
	}
</style>
