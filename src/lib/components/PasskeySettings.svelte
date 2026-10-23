<script lang="ts">
	import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser';
	import { invalidate } from '$app/navigation';
	import type { PasskeySummary } from '$lib/types/settings';
	import UserKey from '@lucide/svelte/icons/user-key';
	import { m } from '$lib/paraglide/messages';
	import { ReefError } from '$lib/types/errors';

	let { passkeys }: { passkeys: PasskeySummary[] } = $props();

	let message = $state('');
	let registering = $state(false);

	function displayName(passkey: PasskeySummary) {
		return (
			passkey.name ?? (passkey.deviceType === 'multiDevice' ? m.settings_passkey_type_multi_device() : m.settings_passkey_type_device())
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
				message = m.login_error_passkey_insecure();
				return;
			}

			const optionsResponse = await fetch('/api/passkeys/registration/options', {
				method: 'POST'
			});

			if (!optionsResponse.ok) throw new ReefError('passkey_start_failed')

			const optionsJSON = await optionsResponse.json();
			const response = await startRegistration({ optionsJSON });
			const verificationResponse = await fetch('/api/passkeys/registration/verify', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(response)
			});

			if (!verificationResponse.ok) throw new ReefError('passkey_failed')
			message = m.settings_passkey_add_success();
			await invalidate('app:passkeys');
		} catch (error) {
    		if (error instanceof ReefError && error.code === 'passkey_start_failed') {
    			message = m.login_error_passkey_start_failed();
    		} else if (error instanceof Error && error.name === 'NotAllowedError') {
    			message = m.login_error_passkey_cancelled();
    		} else {
    			message = m.login_error_passkey_failed();
    		}
		} finally {
			registering = false;
		}
	}
</script>


<section aria-labelledby="passkeys-heading">
	<header class="mb-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
		<div>
			<h2 id="passkeys-heading" class="text-lg font-semibold">{m.settings_passkey_title()}</h2>
			<p class="mt-1 max-w-2xl text-sm opacity-65">
				{m.settings_passkey_subtitle()}
			</p>
		</div>

		<button class="btn btn-primary" type="button" onclick={addPasskey} disabled={registering}>
			{registering ? m.settings_passkey_button_add_loading() : m.settings_passkey_button_add()}
		</button>
	</header>

	<div class="overflow-hidden rounded-2xl border border-base-300 bg-base-200">
		<div class="border-b border-base-300 px-5 py-3">
			<div class="flex items-center justify-between">
				<p class="text-sm font-medium">{m.settings_passkey_registered_subheading()}</p>
				<span class="text-sm opacity-60">
					{m.settings_passkey_registered_count({ count: passkeys.length })}
				</span>
			</div>
		</div>

		{#if passkeys.length === 0}
			<div class="p-6">
				<p class="font-medium">{m.settings_passkey_empty_title()}</p>
				<p class="mt-1 text-sm opacity-65">{m.settings_passkey_empty_description()}</p>
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
								{passkey.backedUp
									? m.settings_passkey_added_synced({ date: formatDate(passkey.createdAt) })
									: m.settings_passkey_added_device_only({ date: formatDate(passkey.createdAt) })}
							</p>
						</div>

						{#if passkey.transports?.includes('internal')}
							<span class="badge hidden badge-ghost sm:inline-flex">
								{m.settings_passkey_badge_this_device()}
							</span>
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
