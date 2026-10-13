<script lang="ts">
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
		<h2 id="access-heading" class="text-lg font-semibold">Data access logs</h2>
		<p class="mt-1 max-w-2xl text-sm opacity-65">
			Requests Reef has made to Nintendo on your behalf. Data is stored for 30 days.
		</p>
	</header>

	<div class="overflow-hidden rounded-2xl border border-base-300 bg-base-200">
		<div class="flex items-center justify-between gap-4 border-b border-base-300 px-5 py-3">
			<p class="text-sm font-medium">Recent requests</p>

			<div class="flex items-center gap-2">
				<span class="text-sm opacity-60">{dataAccessLogs.length} most recent</span>
			</div>
		</div>

		{#if dataAccessLogs.length === 0}
			<div class="p-6">
				<p class="font-medium">No requests yet</p>
				<p class="mt-1 text-sm opacity-65">
					Requests this app makes to Nintendo will show up here as you use it.
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
								<span class="badge badge-soft badge-error">Failed</span>
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
