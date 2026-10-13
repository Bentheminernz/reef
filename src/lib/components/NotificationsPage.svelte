<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Info from '@lucide/svelte/icons/info';
	import Newspaper from '@lucide/svelte/icons/newspaper';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Wrench from '@lucide/svelte/icons/wrench';
	import type { CoralSvelteNotice, Notification } from '$lib/types/notifications';

	let {
		notifications,
		coralSvelteNotices
	}: {
		notifications: Notification[];
		coralSvelteNotices: CoralSvelteNotice[];
	} = $props();

	const categoryIcon: Record<CoralSvelteNotice['category'], typeof Info> = {
		News: Newspaper,
		Update: RefreshCw,
		Maintenance: Wrench,
		Other: Info
	};

	function formatDate(value: number | Date): string {
		const date = typeof value === 'number' ? new Date(value * 1000) : value;
		return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
	}

	let selectedTab = $state<'nso' | 'coralsvelte'>('nso');

	let dialog = $state<HTMLDialogElement>();
	let selectedNotification = $state<Notification>();
	let selectedNotice = $state<CoralSvelteNotice>();
	let modalOpen = $state<boolean>(false);
	let webviewSrc = $derived(
		selectedNotification?.type === 'OPERATION' && selectedNotification.operation.webViewUri
			? `${resolve('/api/nso/announcement')}?url=${encodeURIComponent(selectedNotification.operation.webViewUri)}`
			: undefined
	);

	$effect(() => {
		if (modalOpen && !dialog?.open) {
			dialog?.showModal();
		} else if (!modalOpen && dialog?.open) {
			dialog.close();
		}
	});

	// Lock page scroll while the dialog is open.
	$effect(() => {
		if (!modalOpen) return;

		const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previous;
		};
	});

	async function handleClose() {
		modalOpen = false;

		const notification = selectedNotification;
		const notice = selectedNotice;

		if (notification && !notification.hasRead) {
			try {
				if (notification.type === 'FRIEND_REQUEST') {
					await fetch(
						`${resolve(`/api/friends/requests/${notification.friendRequest.friendRequestId}/read`)}`,
						{ method: 'PUT' }
					);
				} else {
					await fetch(`${resolve('/api/nso/announcement/mark')}`, {
						method: 'PUT',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ id: notification.id })
					});
				}
			} catch (cause) {
				console.warn('Failed to mark announcement read', cause);
			}
		}

		if (notice?.requireAcknowledgement && !notice.acknowledged) {
			try {
				await fetch(`${resolve(`/api/notices/${notice.id}/acknowledge`)}`, {
					method: 'PUT'
				});
			} catch (cause) {
				console.warn('Failed to acknowledge notice', cause);
			}
		}

		selectedNotification = undefined;
		selectedNotice = undefined;

		if (notification || notice) {
			void invalidate('app:notices');
		}
	}
</script>

<div class="w-full py-8 sm:py-10">
	<header class="border-b border-base-300 pb-8">
		<h1 class="mt-1 text-3xl font-bold sm:text-4xl">Notifications</h1>
		<p class="mt-3 max-w-2xl opacity-70">Latest announcements and updates.</p>
	</header>

	<div role="tablist" class="tabs tabs-box">
		<button
			class="tab w-1/2 {selectedTab === 'nso' ? 'tab-active' : ''}"
			onclick={() => (selectedTab = 'nso')}>Nintendo Switch App</button
		>
		<button
			class="tab w-1/2 {selectedTab === 'coralsvelte' ? 'tab-active' : ''}"
			onclick={() => (selectedTab = 'coralsvelte')}
			>Reef
		</button>
	</div>

	{#if selectedTab == 'nso'}
		{#if notifications.length > 0}
			<div class="mt-8 space-y-4 px-1">
				{#each notifications as notification (notification.id)}
					<button
						class="flex w-full cursor-pointer items-center gap-4 rounded-2xl bg-base-200 p-4 ring-1 ring-base-300"
						onclick={() => {
							selectedNotice = undefined;
							selectedNotification = notification;
							modalOpen = true;
						}}
					>
						{#if notification.imageUri}
							<img
								src={notification.imageUri}
								alt=""
								class="size-16 shrink-0 rounded-xl bg-base-300 object-cover"
							/>
						{/if}
						<div class="flex min-w-0 flex-1 flex-col gap-2">
							<div class="flex items-baseline justify-between gap-4">
								<h2 class="font-semibold">{notification.title}</h2>
								<time
									class="shrink-0 text-xs opacity-60"
									datetime={new Date(notification.deliversAt * 1000).toISOString()}
								>
									{formatDate(notification.deliversAt)}
								</time>
							</div>
							<div
								class="size-3 self-end rounded-full {notification.hasRead ? '' : 'bg-blue-400'}"
							></div>
						</div>
					</button>
				{/each}
			</div>
		{:else}
			<div class="mt-8 space-y-8">
				<p class="opacity-65">No news items yet.</p>
			</div>
		{/if}
	{:else}
		{#if coralSvelteNotices.length > 0}
			<div class="mt-8 space-y-4 px-1">
				{#each coralSvelteNotices as notice (notice.id)}
					{@const NoticeIcon = categoryIcon[notice.category]}
					<button
						class="flex w-full cursor-pointer items-center gap-4 rounded-2xl bg-base-200 p-4 ring-1 ring-base-300"
						onclick={() => {
							selectedNotification = undefined;
							selectedNotice = notice;
							modalOpen = true;
						}}
					>
						<div class="grid size-16 shrink-0 place-items-center rounded-xl bg-base-300">
							<NoticeIcon size={32} strokeWidth={1.75} class="text-base-content/70" />
						</div>
						<div class="flex min-w-0 flex-1 flex-col gap-2">
							<div class="flex items-baseline justify-between gap-4">
								<h2 class="font-semibold">{notice.title}</h2>
								<time class="shrink-0 text-xs opacity-60" datetime={notice.createdAt.toISOString()}>
									{formatDate(notice.createdAt)}
								</time>
							</div>
							<div class="flex items-center justify-between gap-4">
								<span class="text-xs opacity-60">{notice.category}</span>
								<div
									class="size-3 rounded-full {notice.requireAcknowledgement && !notice.acknowledged
										? 'bg-blue-400'
										: ''}"
								></div>
							</div>
						</div>
					</button>
				{/each}
			</div>
		{:else}
			<div class="mt-8 space-y-8">
				<p class="opacity-65">No news items yet.</p>
			</div>
		{/if}
	{/if}
</div>

<dialog bind:this={dialog} class="modal" onclose={handleClose}>
	<div class="modal-box {selectedNotification?.type === 'OPERATION' ? 'max-w-5xl' : 'max-w-xl'}">
		<h2 class="text-xl font-bold">{selectedNotice?.title ?? selectedNotification?.title}</h2>

		{#if selectedNotice}
			<article class="prose max-w-none">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized in $lib/server/markdown.ts -->
				{@html selectedNotice.contentHtml}
			</article>
		{:else if selectedNotification?.type === 'OPERATION'}
			{#if webviewSrc}
				<iframe
					src={webviewSrc}
					title=""
					sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
					class="mt-4 h-[70vh] w-full rounded-xl bg-base-100"
				></iframe>
			{:else}
				<article class="prose max-w-none">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized in $lib/server/markdown.ts -->
					{@html selectedNotification.contentHtml}
				</article>
			{/if}
		{:else}
			<p>Coming soon</p>
		{/if}

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
