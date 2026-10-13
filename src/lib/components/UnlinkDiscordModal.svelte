<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	let {
		open = $bindable(false),
		discordUsername = ''
	}: {
		open?: boolean;
		discordUsername?: string;
	} = $props();

	let dialog = $state<HTMLDialogElement>();
	let unlinking = $state(false);
	let message = $state('');

	$effect(() => {
		if (open && !dialog?.open) {
			dialog?.showModal();
		} else if (!open && dialog?.open) {
			dialog.close();
		}
	});

	// Fresh state every time the modal opens.
	$effect(() => {
		if (!open) return;

		unlinking = false;
		message = '';
	});

	async function unlink() {
		message = '';
		unlinking = true;

		try {
			const response = await fetch('/api/discord/revoke', { method: 'DELETE' });

			if (!response.ok) {
				throw new Error(await responseMessage(response, 'Could not unlink your Discord account.'));
			}

			open = false;
			await invalidateAll();
		} catch (error) {
			message = error instanceof Error ? error.message : 'Could not unlink your Discord account.';
		} finally {
			unlinking = false;
		}
	}

	async function responseMessage(response: Response, fallback: string) {
		const body = (await response.json().catch(() => null)) as { message?: string } | null;
		return body?.message ?? fallback;
	}
</script>

<dialog bind:this={dialog} class="modal" onclose={() => (open = false)}>
	<div class="modal-box">
		<h2 class="text-xl font-bold text-error">Unlink Discord account</h2>
		<p class="mt-2 text-sm opacity-70">
			{discordUsername
				? `This unlinks ${discordUsername}. Discord Rich Presence will stop and Reef's access to your Discord account will be revoked.`
				: `Discord Rich Presence will stop and Reef's access to your Discord account will be revoked.`}
			You can link an account again at any time.
		</p>

		{#if message}
			<p class="mt-4 text-sm text-error" aria-live="polite">{message}</p>
		{/if}

		<div class="modal-action">
			<form method="dialog">
				<button class="btn">Cancel</button>
			</form>

			<button type="button" class="btn btn-error" onclick={unlink} disabled={unlinking}>
				{unlinking ? 'Unlinking…' : 'Unlink Discord account'}
			</button>
		</div>
	</div>

	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
