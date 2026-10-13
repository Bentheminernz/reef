<script lang="ts">
	import { base } from '$app/paths';
	import { onDestroy } from 'svelte';
	import type { GameService, GameServiceSession } from '$lib/types/game-services';

	interface Props {
		services: GameService[];
	}

	let { services }: Props = $props();
	let activeService = $state<GameService | null>(null);
	let webviewSession = $state<GameServiceSession | null>(null);
	let frameUrl = $state('');
	let frame: HTMLIFrameElement | undefined = $state();
	let launchError = $state('');
	let phase = $state<'idle' | 'connecting' | 'loading' | 'active'>('idle');
	let launchEpoch = 0;
	let controller: AbortController | null = null;
	let loadingTimer: ReturnType<typeof setTimeout> | undefined;
	let renewal: Promise<string | null> | null = null;

	$effect(() => {
		if (!activeService) return;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previousOverflow;
		};
	});

	$effect(() => {
		const handleMessage = (event: MessageEvent) => {
			const data = event.data;
			if (
				event.origin !== window.location.origin ||
				!frame?.contentWindow ||
				event.source !== frame.contentWindow ||
				!webviewSession ||
				!activeService ||
				!data ||
				typeof data !== 'object' ||
				String(data.sessionId || '') !== webviewSession.sessionId ||
				String(data.serviceId || '') !== String(activeService.id)
			) {
				return;
			}

			if (data.type === 'NSO_REQUEST_GAME_WEB_TOKEN') {
				void renewGameToken(String(data.requestId || ''));
				return;
			}

			if (data.type === 'NSO_CLOSE_WEBVIEW') {
				void closeService();
				return;
			}

			if (data.type === 'NSO_COMPLETE_LOADING') {
				markLoaded();
				return;
			}

			if (data.type === 'NSO_COPY_TO_CLIPBOARD' && data.text) {
				void navigator.clipboard?.writeText(String(data.text));
				return;
			}

			if (data.type === 'NSO_OPEN_EXTERNAL_BROWSER' && data.url) {
				openExternalUrl(String(data.url));
				return;
			}

			if (data.type === 'NSO_SEND_MESSAGE' && data.data) {
				try {
					const message = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
					if (message?.type === 'B_SHOW_ERROR') {
						console.warn('[NookLink] Service error', message.message || message);
					}
				} catch {
					console.warn('[NookLink] Invalid service message');
				}
				return;
			}

			if (
				(data.type === 'NSO_NATIVE_SHARE' || data.type === 'NSO_NATIVE_SHARE_URL') &&
				navigator.share
			) {
				void navigator
					.share({
						title: activeService.name,
						text: typeof data.text === 'string' ? data.text : '',
						url: typeof data.url === 'string' ? data.url : undefined
					})
					.catch(() => undefined);
			}
		};

		window.addEventListener('message', handleMessage);
		return () => window.removeEventListener('message', handleMessage);
	});

	onDestroy(() => {
		controller?.abort();
		clearLoadingTimer();
		if (webviewSession) void closeLocalSession(webviewSession.sessionId);
	});

	async function launchService(service: GameService) {
		if (phase !== 'idle') return;

		const epoch = ++launchEpoch;
		controller = new AbortController();
		activeService = service;
		webviewSession = null;
		frameUrl = '';
		launchError = '';
		phase = 'connecting';

		try {
			const session = await requestLocalSession(service.id, false, controller.signal);
			if (epoch !== launchEpoch) {
				void closeLocalSession(session.sessionId);
				return;
			}

			const webviewUrl = new URL(session.webviewUrl, window.location.origin);
			if (webviewUrl.origin !== window.location.origin || !session.sessionId) {
				throw new Error('The local WebView returned an invalid session.');
			}

			webviewSession = session;
			frameUrl = webviewUrl.href;
			phase = 'loading';
		} catch (cause) {
			if (epoch !== launchEpoch || controller?.signal.aborted) return;
			launchError =
				cause instanceof Error ? cause.message : 'The game service could not be opened.';
			phase = 'idle';
		}
	}

	async function requestLocalSession(serviceId: number, forceFresh: boolean, signal: AbortSignal) {
		const response = await fetch(`${base}/api/game-services/${encodeURIComponent(serviceId)}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			signal,
			body: JSON.stringify({ forceFresh })
		});

		if (!response.ok)
			throw new Error(
				await responseMessage(response, 'Nintendo could not start this game service.')
			);
		return (await response.json()) as GameServiceSession;
	}

	async function renewGameToken(requestId: string) {
		if (!activeService || !webviewSession || !controller) return;

		const sessionId = webviewSession.sessionId;
		const signal = controller.signal;

		if (!renewal) {
			renewal = (async () => {
				try {
					const response = await fetch(
						`${base}/api/game-services/session/${encodeURIComponent(sessionId)}/renew-token`,
						{
							method: 'POST',
							headers: { Accept: 'application/json' },
							signal
						}
					);
					if (!response.ok) throw new Error('The local WebView could not renew its token.');
					const data = (await response.json()) as { token?: string };
					return webviewSession?.sessionId === sessionId && !signal.aborted
						? data.token || null
						: null;
				} catch (cause) {
					if (!signal.aborted && webviewSession?.sessionId === sessionId) {
						console.error('[GameService] Token renewal failed', cause);
					}
					return null;
				} finally {
					renewal = null;
				}
			})();
		}

		const token = await renewal;
		if (!signal.aborted && webviewSession?.sessionId === sessionId) {
			frame?.contentWindow?.postMessage(
				{ type: 'NSO_RECEIVE_GAME_WEB_TOKEN', requestId, token },
				window.location.origin
			);
		}
	}

	async function closeService() {
		const sessionId = webviewSession?.sessionId;
		++launchEpoch;
		controller?.abort();
		controller = null;
		webviewSession = null;
		frameUrl = '';
		activeService = null;
		launchError = '';
		phase = 'idle';
		clearLoadingTimer();

		if (sessionId) await closeLocalSession(sessionId);
	}

	async function closeLocalSession(id: string) {
		if (!id) return;
		try {
			await fetch(`${base}/api/game-services/session/${encodeURIComponent(id)}`, {
				method: 'DELETE',
				keepalive: true
			});
		} catch (cause) {
			console.warn('[GameService] Local session cleanup failed', cause);
		}
	}

	function frameLoaded() {
		clearLoadingTimer();
		loadingTimer = setTimeout(markLoaded, 5000);
	}

	function markLoaded() {
		clearLoadingTimer();
		if (phase === 'loading') phase = 'active';
	}

	function clearLoadingTimer() {
		if (loadingTimer) clearTimeout(loadingTimer);
		loadingTimer = undefined;
	}

	function openExternalUrl(value: string) {
		try {
			const url = new URL(value);
			if (url.protocol === 'https:' || url.protocol === 'http:') {
				window.open(url.href, '_blank', 'noopener,noreferrer');
			}
		} catch {
			// Ignore malformed bridge URLs.
		}
	}

	async function responseMessage(response: Response, fallback: string) {
		try {
			const body = await response.json();
			return typeof body?.message === 'string'
				? body.message
				: typeof body?.error === 'string'
					? body.error
					: fallback;
		} catch {
			return fallback;
		}
	}
</script>

{#if services.length === 0}
	<p class="rounded-xl bg-base-200 p-4 text-sm text-base-content/70">
		No game services are available for this Nintendo Account.
	</p>
{:else}
	<div class="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
		{#each services as service (service.id)}
			<button
				type="button"
				class="group w-32 shrink-0 snap-start text-left disabled:cursor-not-allowed disabled:opacity-55 lg:w-48 xl:w-64"
				disabled={phase !== 'idle'}
				onclick={() => launchService(service)}
				aria-label={`Open ${service.name}`}
			>
				<img
					src={service.imageUri}
					class="aspect-square w-full cursor-pointer rounded-xl bg-base-300 object-cover shadow-sm transition group-enabled:group-hover:scale-[1.015] group-enabled:group-hover:shadow-md"
					alt=""
					loading="eager"
				/>
				<span class="text-md mt-2 block font-semibold lg:text-lg">{service.name}</span>
			</button>
		{/each}
	</div>
{/if}

{#if activeService}
	<!-- z-50: above the dashboard header (z-40), below the blocking modals (z-60/70). -->
	<div
		class="fixed inset-0 z-50 flex flex-col bg-base-100"
		role="dialog"
		aria-modal="true"
		aria-label={activeService.name}
	>
		<header
			class="flex min-h-14 items-center gap-3 border-b border-base-300 bg-base-100 px-3 pt-[env(safe-area-inset-top)] shadow-sm"
		>
			<button
				type="button"
				class="btn btn-circle btn-ghost btn-sm"
				onclick={closeService}
				aria-label="Close game service"
			>
				<svg viewBox="0 0 24 24" class="size-5" aria-hidden="true">
					<path fill="currentColor" d="m15.4 18-6-6 6-6L14 4.6 6.6 12l7.4 7.4z" />
				</svg>
			</button>
			<img src={activeService.imageUri} alt="" class="size-9 rounded-lg object-cover" />
			<strong class="min-w-0 flex-1 truncate">{activeService.name}</strong>
			{#if phase === 'active'}
				<button
					type="button"
					class="btn btn-circle btn-ghost btn-sm"
					onclick={() => {
						if (frameUrl)
							frameUrl = `${frameUrl}${frameUrl.includes('?') ? '&' : '?'}reload=${Date.now()}`;
					}}
					aria-label="Reload game service"
				>
					<svg viewBox="0 0 24 24" class="size-5" aria-hidden="true">
						<path
							fill="currentColor"
							d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7a5 5 0 1 1-4.9 6H4.02A8 8 0 1 0 17.65 6.35"
						/>
					</svg>
				</button>
			{/if}
		</header>

		<div class="relative min-h-0 flex-1 bg-black">
			{#if frameUrl}
				<iframe
					bind:this={frame}
					src={frameUrl}
					title={activeService.name}
					class="size-full border-0 bg-black"
					allow="screen-wake-lock"
					onload={frameLoaded}
				></iframe>
			{/if}

			{#if phase === 'connecting' || phase === 'loading'}
				<div class="absolute inset-0 grid place-items-center bg-base-100">
					<div class="flex max-w-xs flex-col items-center gap-4 px-6 text-center">
						<img
							src={activeService.imageUri}
							alt=""
							class="size-24 rounded-2xl object-cover shadow-lg"
						/>
						<span class="loading loading-lg loading-spinner text-error" aria-hidden="true"></span>
						<strong
							>{phase === 'connecting' ? 'Connecting to Nintendo…' : 'Loading service…'}</strong
						>
					</div>
				</div>
			{/if}

			{#if launchError}
				<div class="absolute inset-0 grid place-items-center bg-base-100 p-6">
					<div class="max-w-sm text-center">
						<h2 class="text-xl font-bold">Could not open {activeService.name}</h2>
						<p class="mt-2 text-base-content/70">{launchError}</p>
						<div class="mt-5 flex justify-center gap-3">
							<button type="button" class="btn" onclick={closeService}>Close</button>
							<button
								type="button"
								class="btn btn-error"
								onclick={() => launchService(activeService!)}>Try again</button
							>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
