<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { SiteSettingsSummary } from '$lib/types/settings';

	let { adminSettings }: { adminSettings: SiteSettingsSummary | null } = $props();

	let message = $state('');
	let saved = $state(false);
	let signUpEnabledHidden = $state<HTMLInputElement>();
	let discordEnrolmentEnabledHidden = $state<HTMLInputElement>();

	const submit: SubmitFunction =
		() =>
		async ({ result, update }) => {
			message = '';
			saved = false;

			if (result.type === 'error') {
				message = String(result.error?.message ?? 'Something went wrong.');
				return;
			}

			if (result.type === 'failure') {
				message = String(result.data?.message ?? 'Something went wrong.');
				return;
			}

			saved = true;
			await update({ invalidateAll: true });
		};

	function setHiddenFlag(input: HTMLInputElement | undefined, checked: boolean) {
		if (input) input.value = checked ? 'true' : 'false';
	}
</script>

<section aria-labelledby="admin-heading">
	<header class="mb-3">
		<h2 id="admin-heading" class="text-lg font-semibold">Admin</h2>
	</header>

	<form method="POST" action="?/updateAdminSettings" use:enhance={submit}>
		<div class="overflow-hidden rounded-2xl border border-base-300 bg-base-200">
			<input
				type="hidden"
				name="signUpEnabled"
				value={adminSettings?.signUpEnabled ? 'true' : 'false'}
				bind:this={signUpEnabledHidden}
			/>

			<label class="flex items-center gap-4 p-5">
				<span class="min-w-0 flex-1">
					<span class="block font-semibold">Allow new sign-ups</span>
					<span class="mt-0.5 block text-sm opacity-65">
						Let new Nintendo accounts create an account.
					</span>
				</span>

				<input
					type="checkbox"
					class="toggle toggle-primary"
					checked={adminSettings?.signUpEnabled ?? false}
					onchange={(event) => setHiddenFlag(signUpEnabledHidden, event.currentTarget.checked)}
				/>
			</label>

			<div class="border-t border-base-300"></div>

			<input
				type="hidden"
				name="discordEnrolmentEnabled"
				value={adminSettings?.discordEnrolmentEnabled ? 'true' : 'false'}
				bind:this={discordEnrolmentEnabledHidden}
			/>

			<label class="flex items-center gap-4 p-5">
				<span class="min-w-0 flex-1">
					<span class="block font-semibold">Allow Discord enrolments</span>
					<span class="mt-0.5 block text-sm opacity-65">Let users enrol w/ dicord</span>
				</span>

				<input
					type="checkbox"
					class="toggle toggle-primary"
					checked={adminSettings?.discordEnrolmentEnabled ?? false}
					onchange={(event) =>
						setHiddenFlag(discordEnrolmentEnabledHidden, event.currentTarget.checked)}
				/>
			</label>

			<div class="border-t border-base-300"></div>

			<label class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
				<span class="min-w-0 flex-1">
					<span class="block font-semibold">Discord enrolment limit</span>
					<span class="mt-0.5 block text-sm opacity-65">
						Maximum number of users that can be enrolled with Discord.
					</span>
				</span>

				<input
					type="number"
					min="0"
					step="1"
					name="discordEnrolmentLimit"
					class="input w-full sm:w-40"
					value={adminSettings?.discordEnrolmentLimit ?? 100}
				/>
			</label>

			<div class="border-t border-base-300"></div>

			<label class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
				<span class="min-w-0 flex-1">
					<span class="block font-semibold">Discord invite link</span>
					<span class="mt-0.5 block text-sm opacity-65">
						Invite link shown to users to join the Discord server.
					</span>
				</span>

				<input
					type="url"
					name="discordInviteLink"
					class="input w-full sm:w-64"
					value={adminSettings?.discordInviteLink ?? 'https://discord.gg/bmCyVeF6Vw'}
				/>
			</label>
		</div>

		<div class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
			<button class="btn w-full btn-primary sm:w-auto" type="submit">Save</button>

			{#if message}
				<p aria-live="polite" class="text-sm text-error">{message}</p>
			{:else if saved}
				<p aria-live="polite" class="text-sm text-success">Admin settings saved.</p>
			{/if}
		</div>
	</form>
</section>
