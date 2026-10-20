<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser';
	import type { PageProps } from './$types';
	import UserKey from '@lucide/svelte/icons/user-key';
	import ReefIcon from '$lib/assets/ReefIcon.svg';

	let { data, form }: PageProps = $props();

	let passkeyMessage = $state('');
	let authenticating = $state(false);

	const nintendoSteps = [
		'Open the Nintendo sign-in page and log in.',
		'Pick the Nintendo Account you want to use.',
		'Right-click “Select this person” and choose “Copy Link”. On a phone, long-press instead.',
		'Paste the link below and continue.'
	];

	async function signInWithPasskey() {
		passkeyMessage = '';
		authenticating = true;

		try {
			if (!window.isSecureContext || !browserSupportsWebAuthn()) {
				passkeyMessage = 'Passkeys require localhost or a secure HTTPS connection.';
				return;
			}

			const optionsResponse = await fetch('/api/passkeys/authentication/options', {
				method: 'POST'
			});
			if (!optionsResponse.ok) throw new Error('Could not start passkey sign-in');

			const optionsJSON = await optionsResponse.json();
			const response = await startAuthentication({ optionsJSON });
			const verificationResponse = await fetch('/api/passkeys/authentication/verify', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(response)
			});

			if (!verificationResponse.ok) throw new Error('Passkey sign-in failed');
			await goto(resolve('/'));
		} catch (error) {
			passkeyMessage =
				error instanceof Error && error.name === 'NotAllowedError'
					? 'Passkey sign-in was cancelled.'
					: error instanceof Error
						? error.message
						: 'Passkey sign-in failed.';
		} finally {
			authenticating = false;
		}
	}

	const accordionItems: {
		title: string;
		intro: string;
		endpoints?: string[];
	}[] = [
		{
			title: 'Why is Discord asking for so many scary permissions?',
			intro:
				'Unfortunately Discord has discontinued their activities.write scope for applications.\nThis means the only way to write activities is via the Social SDK. This SDK is designed so Discord can be implemented into games, which is why it needs so many scopes.\nHowever, Reef only uses a very small subset of these scopes. Below are the current Discord APIs that Reef accesses:',
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
			title: 'How are my Nintendo tokens stored? Can you see them?',
			intro:
				'Your sign-in details, the Nintendo session token and Switch Online access tokens Reef uses to fetch your presence and friends, plus the webview cookies for game services, are all encrypted before they are saved, those values only ever live in the database as ciphertext.\n\n' +
				'Encryption keys are kept confidential, are never logged, and are not stored in the database or its backups, so a stolen database copy is useless on its own. Stored data is also tamper-evident: if any of it is altered or forged, Reef refuses to decrypt it.\n\n' +
				'Tokens are only decrypted for a split second, in memory, when Reef needs to talk to Nintendo on your behalf. Nothing is ever written back in plaintext, and the app has no admin view, API or export that can display your tokens.\n\n' +
				'Your Nintendo Account ID is stored in the clear, but that is a public identifier, not a secret. Tokens are only ever sent to Nintendo\u2019s servers (and to nxapi-znca-api, the service that decrypts and re-encrypts Nintendo Switch App requests, see the link above). Deleting your account (Settings -> Delete account) removes all of it.'
		},
		{
			title: 'Will I get banned?',
			intro:
				'Most likely not. Nobody has been banned yet for legitimately using third-party clients (including nxapi).\n\n' +
				'However, a small subset of users was banned from SplatNet 3 in 2023 for attempting to exploit elements of SplatNet 3. ' +
				'This only resulted in a ban from SplatNet 3, no other Nintendo services were affected, including their accounts or consoles.'
		}
	];

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
			<span>Sign ups are currently disabled. Please check back later!</span>
		</div>
	{/if}

	{#if data.declined}
		<div class="alert alert-warning" role="alert">
			<span>
				You must accept the <a class="link" href={resolve('/privacy')}>Privacy Policy</a> to use Reef.
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
					<h2 id="passkey-heading" class="font-semibold">Passkey</h2>
					<p class="text-sm opacity-65">Sign in with biometrics</p>
				</div>
			</div>

			<button
				class="btn w-full btn-primary"
				type="button"
				onclick={signInWithPasskey}
				disabled={authenticating}
			>
				{authenticating ? 'Signing in...' : 'Sign in with a passkey'}
			</button>

			{#if passkeyMessage}
				<p class="text-sm opacity-80" aria-live="polite">{passkeyMessage}</p>
			{/if}
		</div>
	</section>

	<div class="divider text-xs opacity-60">or sign in with Nintendo</div>

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
				Open Nintendo sign-in page
			</a>

			{#if form?.message}
				<p class="text-sm text-error" aria-live="polite">{form.message}</p>
			{/if}

			<form method="POST" action="?/login" class="flex flex-col gap-2">
				<input type="hidden" name="authoriseUrl" value={data.authoriseUrl} />
				<input type="hidden" name="state" value={data.state} />
				<input type="hidden" name="verifier" value={data.verifier} />

				<label class="text-sm font-medium" for="redirect-uri">Authorisation link</label>
				<input
					id="redirect-uri"
					class="input w-full"
					name="redirectUri"
					value={typeof form?.redirectUri === 'string' ? form.redirectUri : ''}
					placeholder="Paste the copied link"
					autocomplete="off"
					autocapitalize="off"
					autocorrect="off"
					spellcheck="false"
					required
				/>

				<button class="btn w-full btn-primary" type="submit">Continue</button>
			</form>

			<p class="text-xs opacity-65">
				{#if data.availableSystemBots.length > 0}
					When you link a Discord account, one of these users <code
						class="rounded bg-base-200 px-1 font-mono">{data.availableSystemBots.join(', ')}</code
					>
					will be added to your friends list. This is our system user so your presence can be shown on
					Discord.
				{:else}
					All of our system users are full right now, so Discord linking is unavailable.
				{/if}
				<br /><br />
				Your account is created automatically the first time you sign in. By signing up, you agree to
				our
				<a class="link link-primary" href={resolve('/privacy')}>Privacy Policy</a>.
				<br /><br />
				This service is provided by nxapi and the nxapi-znca-api. Information regarding these services
				are provided
				<a
					class="link link-primary"
					href="https://markdownpreview.github.io/?https://raw.githubusercontent.com/samuelthomas2774/nxapi-znca-api/refs/heads/docs/docs/end-user-help.md"
					>here</a
				>
				<br /><br />
				Need support?
				<a class="link link-primary" href={data.discordInvite} target="_blank">Join the Discord!</a>
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
							<p class="whitespace-pre-line">{item.intro}</p>

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
