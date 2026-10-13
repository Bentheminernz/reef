<script lang="ts">
	import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser';
	import { invalidate } from '$app/navigation';
	import type { PasskeySummary } from '$lib/types/settings';
	import UserKey from '@lucide/svelte/icons/user-key';

	let { passkeys }: { passkeys: PasskeySummary[] } = $props();

	let message = $state('');
	let registering = $state(false);

	function displayName(passkey: PasskeySummary) {
		return (
			passkey.name ?? (passkey.deviceType === 'multiDevice' ? 'Synced passkey' : 'Device passkey')
		);
	}

	function formatDate(value: Date) {
		return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(value);
	}

	async function addPasskey() {
		message = '';
		registering = true;

		try {
			if (!window.isSecureContext || !browserSupportsWebAuthn()) {
				message = 'Passkeys require localhost or a secure HTTPS connection.';
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

			if (!verificationResponse.ok) throw new Error('Passkey registration failed');
			message = 'Passkey registered.';
			await invalidate('app:passkeys');
		} catch (error) {
			message =
				error instanceof Error && error.name === 'NotAllowedError'
					? 'Passkey registration was cancelled.'
					: error instanceof Error
						? error.message
						: 'Passkey registration failed.';
		} finally {
			registering = false;
		}
	}
</script>

<section aria-labelledby="passkeys-heading">
	<header class="mb-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
		<div>
			<h2 id="passkeys-heading" class="text-lg font-semibold">Passkeys</h2>
			<p class="mt-1 max-w-2xl text-sm opacity-65">
				Use your device's screen lock, fingerprint, or face recognition to sign in without Nintendo
				authorisation.
			</p>
		</div>

		<button class="btn btn-primary" type="button" onclick={addPasskey} disabled={registering}>
			{registering ? 'Adding passkey...' : 'Add passkey'}
		</button>
	</header>

	<div class="overflow-hidden rounded-2xl border border-base-300 bg-base-200">
		<div class="border-b border-base-300 px-5 py-3">
			<div class="flex items-center justify-between">
				<p class="text-sm font-medium">Registered passkeys</p>
				<span class="text-sm opacity-60">
					{passkeys.length}
					{passkeys.length === 1 ? 'passkey' : 'passkeys'}
				</span>
			</div>
		</div>

		{#if passkeys.length === 0}
			<div class="p-6">
				<p class="font-medium">No passkeys registered</p>
				<p class="mt-1 text-sm opacity-65">Add one to enable passkey sign-in on this account.</p>
			</div>
		{:else}
			<ul class="divide-y divide-base-300">
				{#each passkeys as passkey (passkey.id)}
					<li class="flex items-center gap-4 p-5">
						<div
							class="grid size-11 shrink-0 place-items-center rounded-full bg-primary/15 text-primary"
						>
							<UserKey />
						</div>

						<div class="min-w-0 flex-1">
							<p class="truncate font-semibold">{displayName(passkey)}</p>
							<p class="mt-0.5 text-sm opacity-65">
								Added {formatDate(passkey.createdAt)}
								{passkey.backedUp ? ' · Synced' : ' · This device only'}
							</p>
						</div>

						{#if passkey.transports?.includes('internal')}
							<span class="badge hidden badge-ghost sm:inline-flex">This device</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	{#if message}
		<p class="mt-5" aria-live="polite">{message}</p>
	{/if}
</section>
