<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let {
		open = $bindable(false)
	}: {
		open?: boolean;
	} = $props();

	let dialog = $state<HTMLDialogElement>();
	let confirmed = $state(false);
	let started = $state(false);
	let busy = $state(false);
	let deleting = $state(false);
	let authoriseUrl = $state('');
	let challengeState = $state('');
	let verifier = $state('');
	let redirectUri = $state('');
	let message = $state('');

	$effect(() => {
		if (open && !dialog?.open) {
			dialog?.showModal();
		} else if (!open && dialog?.open) {
			dialog.close();
		}
	});

	// Fresh flow every time the modal opens.
	$effect(() => {
		if (!open) return;

		confirmed = false;
		started = false;
		busy = false;
		deleting = false;
		authoriseUrl = '';
		challengeState = '';
		verifier = '';
		redirectUri = '';
		message = '';
	});

	const deletionSteps = [
		'Open the Nintendo sign-in page and log in.',
		'Pick the Nintendo Account linked to this service.',
		'Right-click “Select this person” and choose “Copy Link”. On a phone, long-press instead.',
		'Paste the link below and confirm deletion.'
	];

	async function startDeletion() {
		message = '';
		busy = true;

		try {
			const response = await fetch('/api/auth/deleteAccount');

			if (!response.ok) throw new Error('Could not start account deletion.');

			const challenge = (await response.json()) as {
				authoriseUrl: string;
				state: string;
				verifier: string;
			};

			authoriseUrl = challenge.authoriseUrl;
			challengeState = challenge.state;
			verifier = challenge.verifier;
			started = true;
		} catch (error) {
			message = error instanceof Error ? error.message : 'Could not start account deletion.';
		} finally {
			busy = false;
		}
	}

	async function deleteAccount() {
		message = '';

		if (!redirectUri.trim() || !authoriseUrl || !challengeState || !verifier) return;

		deleting = true;

		try {
			const response = await fetch('/api/auth/deleteAccount', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					redirectURI: redirectUri,
					authoriseUrl,
					state: challengeState,
					verifier
				})
			});

			if (!response.ok) {
				throw new Error(await responseMessage(response, 'Account deletion failed.'));
			}

			await goto(resolve('/login'));
		} catch (error) {
			message = error instanceof Error ? error.message : 'Account deletion failed.';
		} finally {
			deleting = false;
		}
	}

	async function responseMessage(response: Response, fallback: string) {
		const body = (await response.json().catch(() => null)) as { message?: string } | null;
		return body?.message ?? fallback;
	}
</script>

<dialog bind:this={dialog} class="modal" onclose={() => (open = false)}>
	<div class="modal-box">
		<h2 class="text-xl font-bold text-error">Delete account</h2>
		<p class="mt-2 text-sm opacity-70">
			This permanently deletes your account, Discord link, presence sharing and stored data. It
			cannot be undone.
		</p>

		<div class="mt-5">
			{#if !started}
				<label class="flex items-start gap-3">
					<input
						type="checkbox"
						class="checkbox mt-0.5 checkbox-sm checkbox-error"
						bind:checked={confirmed}
					/>
					<span class="text-sm opacity-80">
						I understand this permanently deletes my account and all linked data.
					</span>
				</label>
			{:else}
				<ol class="flex flex-col gap-3">
					{#each deletionSteps as step, index (step)}
						<li class="flex items-start gap-3">
							<span
								class="grid size-6 shrink-0 place-items-center rounded-full bg-error/15 text-xs font-semibold text-error"
							>
								{index + 1}
							</span>
							<span class="text-sm opacity-80">{step}</span>
						</li>
					{/each}
				</ol>

				<a
					href={authoriseUrl}
					target="_blank"
					rel="noopener"
					class="btn mt-4 w-full btn-outline btn-error"
				>
					Open Nintendo sign-in page
				</a>

				<label class="mt-4 block text-sm font-medium" for="delete-redirect-uri"
					>Authorisation link</label
				>
				<input
					id="delete-redirect-uri"
					class="input w-full"
					bind:value={redirectUri}
					placeholder="Paste the copied link"
					autocomplete="off"
					autocapitalize="off"
					autocorrect="off"
					spellcheck="false"
				/>

				<button
					type="button"
					class="btn mt-4 w-full btn-error"
					onclick={deleteAccount}
					disabled={deleting || !redirectUri.trim()}
				>
					{deleting ? 'Deleting…' : 'Delete my account'}
				</button>
			{/if}

			{#if message}
				<p class="mt-4 text-sm text-error" aria-live="polite">{message}</p>
			{/if}
		</div>

		<div class="modal-action">
			{#if !started}
				<button
					type="button"
					class="btn btn-error"
					onclick={startDeletion}
					disabled={!confirmed || busy}
				>
					{busy ? 'Starting…' : 'Continue'}
				</button>
			{/if}

			<form method="dialog">
				<button class="btn">Close</button>
			</form>
		</div>
	</div>

	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
