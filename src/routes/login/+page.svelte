<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser';
	import type { PageProps } from './$types';
	import UserKey from '@lucide/svelte/icons/user-key';
	import ReefIcon from '$lib/assets/ReefIcon.svg';
	import { m } from '$lib/paraglide/messages';
	import { errorMessage, ReefError } from '$lib/types/errors';

	let { data, form }: PageProps = $props();

	let passkeyMessage = $state('');
	let authenticating = $state(false);

	const nintendoSteps: string[] = $derived([
		m.login_nintendo_guide_p1(),
		m.login_nintendo_guide_p2(),
		m.login_nintendo_guide_p3(),
		m.login_nintendo_guide_p4()
	]);

	async function signInWithPasskey() {
		passkeyMessage = '';
		authenticating = true;

		try {
			if (!window.isSecureContext || !browserSupportsWebAuthn()) {
				passkeyMessage = m.login_error_passkey_insecure();
				return;
			}

			const optionsResponse = await fetch('/api/passkeys/authentication/options', {
				method: 'POST'
			});
			if (!optionsResponse.ok) throw new ReefError('passkey_start_failed');

			const optionsJSON = await optionsResponse.json();
			const response = await startAuthentication({ optionsJSON });
			const verificationResponse = await fetch('/api/passkeys/authentication/verify', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(response)
			});

			if (!verificationResponse.ok) throw new ReefError('passkey_failed');
			await goto(resolve('/'));
		} catch (error) {
			if (error instanceof ReefError && error.code === 'passkey_start_failed') {
				passkeyMessage = m.login_error_passkey_start_failed();
			} else if (error instanceof Error && error.name === 'NotAllowedError') {
				passkeyMessage = m.login_error_passkey_cancelled();
			} else {
				passkeyMessage = m.login_error_passkey_failed();
			}
		} finally {
			authenticating = false;
		}
	}

	const accordionItems: {
		title: string;
		paragraphs: string[];
		endpoints?: string[];
	}[] = $derived([
		{
			title: m.faq_discord_scopes_title(),
			paragraphs: [m.faq_discord_scopes_p1(), m.faq_discord_scopes_p2(), m.faq_discord_scopes_p3()],
			endpoints: [
				'/oauth2/authorize',
				'/api/oauth2/token',
				'/api/users/@me',
				'/api/v10/users/@me/headless-sessions',
				'/api/v10/users/@me/headless-sessions/delete',
				'/api/oauth2/token/revoke'
			]
		},
		{
			title: m.faq_tokens_title(),
			paragraphs: [m.faq_tokens_p1(), m.faq_tokens_p2(), m.faq_tokens_p3(), m.faq_tokens_p4()]
		},
		{
			title: m.faq_ban_title(),
			paragraphs: [m.faq_ban_p1(), m.faq_ban_p2()]
		}
	]);

	let openIndex = $state<number | null>(0);
</script>

<div class="mx-auto flex w-full max-w-md flex-col gap-5 py-8">
	<header class="flex flex-col items-center gap-3 text-center">
		<div
			class="flex items-center gap-2 rounded-full bg-nintendo-home-light p-2 pr-3 shadow-md ring-1 ring-base-300"
		>
			<img src={ReefIcon} alt="" class="size-6" />
			<h1 class="font-semibold text-white">Reef</h1>
		</div>
	</header>

	{#if !data.signUpEnabled}
		<div class="alert alert-error" role="alert">
			<span>{m.login_signups_disabled_banner()}</span>
		</div>
	{/if}

	{#if data.declined}
		<div class="alert alert-warning" role="alert">
			<span>
				{m.login_privacy_policy_declined_before()} <a class="link" href={resolve('/privacy')}>{m.common_privacy_policy()}</a> {m.login_privacy_policy_declined_after()}
			</span>
		</div>
	{/if}

	<section
		aria-labelledby="passkey-heading"
		class="overflow-hidden rounded-2xl border border-base-300 bg-base-200"
	>
		<div class="flex flex-col gap-4 p-5">
			<div class="flex items-center gap-3">
				<div
					class="grid size-11 shrink-0 place-items-center rounded-full bg-primary/15 text-primary"
				>
					<UserKey />
				</div>
				<div>
					<h2 id="passkey-heading" class="font-semibold">{m.login_passkey_title()}</h2>
					<p class="text-sm opacity-65">{m.login_passkey_subtitle()}</p>
				</div>
			</div>

			<button
				class="btn w-full btn-primary"
				type="button"
				onclick={signInWithPasskey}
				disabled={authenticating}
			>
				{authenticating ? m.login_passkey_submit_loading() : m.login_passkey_submit()}
			</button>

			{#if passkeyMessage}
				<p class="text-sm opacity-80" aria-live="polite">{passkeyMessage}</p>
			{/if}
		</div>
	</section>

	<div class="divider text-xs opacity-60">{m.login_method_divider()}</div>

	<section
		aria-labelledby="nintendo-heading"
		class="overflow-hidden rounded-2xl border border-base-300 bg-base-200"
	>
		<div class="flex flex-col gap-4 p-5">
			<ol class="flex flex-col gap-3">
				{#each nintendoSteps as step, index (step)}
					<li class="flex items-start gap-3">
						<span
							class="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
						>
							{index + 1}
						</span>
						<span class="text-sm opacity-80">{step}</span>
					</li>
				{/each}
			</ol>

			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href={data.authoriseUrl} target="_blank" rel="noopener" class="btn w-full btn-outline">
				{m.login_nintendo_open_signin_button()}
			</a>

			{#if form?.message}
				<p class="text-sm text-error" aria-live="polite">{errorMessage(form.message)}</p>
			{/if}

			<form method="POST" action="?/login" class="flex flex-col gap-2">
				<input type="hidden" name="authoriseUrl" value={data.authoriseUrl} />
				<input type="hidden" name="state" value={data.state} />
				<input type="hidden" name="verifier" value={data.verifier} />

				<label class="text-sm font-medium" for="redirect-uri"
					>{m.login_nintendo_redirect_label()}</label
				>
				<input
					id="redirect-uri"
					class="input w-full"
					name="redirectUri"
					value={form?.redirectUri ?? ''}
					placeholder={m.login_nintendo_redirect_placeholder()}
					autocomplete="off"
					autocapitalize="off"
					autocorrect="off"
					spellcheck="false"
					required
				/>

				<button class="btn w-full btn-primary" type="submit">{m.common_continue()}</button>
			</form>

			<p class="text-xs opacity-65">
				{#if data.availableSystemBots.length > 0}
					{m.login_system_bots_available({ bots: data.availableSystemBots.join(', ') })}
				{:else}
					{m.login_system_bots_full()}
				{/if}
				<br /><br />
				{m.login_account_created()}
				<a class="link link-primary" href={resolve('/privacy')}>{m.common_privacy_policy()}</a>.
				<br /><br />
				{m.login_service_provided()}
				<a
					class="link link-primary"
					href="https://markdownpreview.github.io/?https://raw.githubusercontent.com/samuelthomas2774/nxapi-znca-api/refs/heads/docs/docs/end-user-help.md"
					>{m.login_service_info_link()}</a
				>
				<br /><br />
				{m.login_support()}
				<a class="link link-primary" href={data.discordInvite} target="_blank"
					>{m.login_join_discord()}</a
				>
			</p>

			<div class="join join-vertical bg-base-100">
				{#each accordionItems as item, i (i)}
					<div
						class="collapse-arrow collapse join-item border border-base-300 {openIndex === i
							? 'collapse-open'
							: ''}"
					>
						<button
							type="button"
							class="collapse-title w-full cursor-pointer text-left font-semibold"
							onclick={() => (openIndex = openIndex === i ? null : i)}
							aria-expanded={openIndex === i}
						>
							{item.title}
						</button>
						<div class="collapse-content flex flex-col gap-3 text-sm">
							<div class="space-y-4">
								{#each item.paragraphs as paragraph, i (i)}
									<p>{paragraph}</p>
								{/each}
							</div>

							{#if item.endpoints}
								<ul class="flex flex-col gap-1.5">
									{#each item.endpoints as endpoint (endpoint)}
										<li>
											<code
												class="block overflow-x-auto rounded-md bg-base-300 px-2 py-1 font-mono text-xs whitespace-nowrap"
											>
												{endpoint}
											</code>
										</li>
									{/each}
								</ul>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>
</div>
