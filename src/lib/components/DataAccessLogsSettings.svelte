<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import type { DataAccessLogSummary } from '$lib/types/settings';
	import { coralEndpointLabel } from '$lib/utils/coralEndpoints';
	import { timeAgo } from '$lib/utils/playTime';

	let { dataAccessLogs = [] }: { dataAccessLogs?: DataAccessLogSummary[] } = $props();

	function formatDate(value: Date) {
		return new Intl.DateTimeFormat(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(value);
	}
</script>

<section aria-labelledby="access-heading">
	<header class="mb-3">
		<h2 id="access-heading" class="text-lg font-semibold">{m.settings_data_title()}</h2>
		<p class="mt-1 max-w-2xl text-sm opacity-65">
			{m.settings_data_subtitle()}
		</p>
	</header>

	<div class="overflow-hidden rounded-2xl border border-base-300 bg-base-200">
		<div class="flex items-center justify-between gap-4 border-b border-base-300 px-5 py-3">
			<p class="text-sm font-medium">{m.settings_data_recent_header()}</p>

			<div class="flex items-center gap-2">
				<span class="text-sm opacity-60">{m.settings_data_recent_total({length: dataAccessLogs.length})}</span>
			</div>
		</div>

		{#if dataAccessLogs.length === 0}
			<div class="p-6">
				<p class="font-medium">{m.settings_data_no_logs_header()}</p>
				<p class="mt-1 text-sm opacity-65">
					{m.settings_data_no_logs_subheader()}
				</p>
			</div>
		{:else}
			<ul class="max-h-96 divide-y divide-base-300 overflow-y-auto">
				{#each dataAccessLogs as log (log.id)}
					<li class="flex items-center gap-3 px-5 py-3">
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium">{coralEndpointLabel(log.endpoint)}</p>
							<p class="truncate font-mono text-xs opacity-45">{log.endpoint}</p>
						</div>

						<div class="flex shrink-0 items-center gap-2">
							{#if !log.ok}
								<span class="badge badge-soft badge-error">{m.common_failed()}</span>
							{/if}

							<time
								class="text-xs opacity-60"
								datetime={log.createdAt.toISOString()}
								title={formatDate(log.createdAt)}
							>
								{timeAgo(Math.floor(log.createdAt.getTime() / 1000))}
							</time>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</section>
