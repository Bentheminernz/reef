import type { Friend_4 } from 'nxapi/coral';

import type { DiscordActivity } from '$lib/types/discord-auth';

export interface PresenceMonitorContext {
	coralFriend: Friend_4;
	enabledWebServices: {
		splatnet3: boolean;
	};
}

/**
 * A presence monitor has its own data source that it can fetch per sync
 * and then it modifies a Discord activity through its callback.
 * This implementation is inspired by nxapi (ellie is a genius)
 */
export interface PresenceMonitor {
	readonly id: string;

	update(): Promise<void>;

	callback(
		activity: DiscordActivity,
		context: PresenceMonitorContext
	): Promise<DiscordActivity | null> | DiscordActivity | null;
}

export async function applyActivityCallbacks(
	monitors: PresenceMonitor[],
	activity: DiscordActivity,
	context: PresenceMonitorContext
): Promise<DiscordActivity> {
	let current = activity;

	for (const monitor of monitors) {
		const result = await monitor.callback(current, context);

		if (result != null) {
			current = result;
		}
	}

	return current;
}

export function setLargeImage(activity: DiscordActivity, large_image: string, large_text: string) {
	activity.assets = { ...activity.assets, large_image, large_text };
}

export function setSmallImage(activity: DiscordActivity, small_image: string, small_text: string) {
	activity.assets = { ...activity.assets, small_image, small_text };
}
