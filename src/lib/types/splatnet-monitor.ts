import type { FriendOnlineState, VsMode } from 'splatnet3-types/splatnet3';

/** The SplatNet friend list entry for the user with the given Nintendo Account ID. */
export function splatnetFriendId(nsaId: string): string {
	return Buffer.from('Friend-' + nsaId).toString('base64');
}

/** The subset of the SplatNet friend presence that the activity uses. */
export interface SplatNetFriend {
	onlineState: FriendOnlineState;
	vsMode: Pick<VsMode, 'id' | 'mode' | 'name'> | null;
	coopRule: string | null;
}

/** The SplatNet friend list entry, plus the icon used to match festival votes. */
export type SplatNetFriendWithIcon = SplatNetFriend & {
	userIcon: { url: string };
};

export interface SplatNetTimePeriod {
	startTime: string;
	endTime: string;
}

export interface SplatNetScheduleItem {
	/** Used by event (league) schedules; regular schedules have startTime/endTime directly. */
	timePeriods?: SplatNetTimePeriod[];
	startTime?: string;
	endTime?: string;
}

/** The current rotation's VS rule and stages, as shown in the activity. */
export interface SplatNetVsSetting {
	vsStages: { id: string; name: string }[];
	vsRule: { name: string };
	leagueMatchEvent?: { name: string };
}

/** The current Salmon Run rotation's stage, as shown in the activity. */
export interface SplatNetCoopSetting {
	coopStage: { name: string; image: { url: string } };
}

/** The current Splatfest, as shown in the activity. */
export interface SplatNetFest {
	id: string;
	tricolorStage: { id: string; name: string; image: { url: string } } | null;
}

/** The team a friend has voted for in the current Splatfest. */
export interface SplatNetFestTeamVotingStatus {
	teamName: string;
}

export interface SplatNetFestVotingStatusResult {
	fest: {
		teams: {
			teamName: string;
			votes: { nodes: { userIcon: { url: string } }[] } | null;
		}[];
	};
}

export interface SplatNetDiscordActivityOptions {
	vsSetting?: SplatNetVsSetting | null;
	coopSetting?: SplatNetCoopSetting | null;
	fest?: SplatNetFest | null;
	festTeamVotingStatus?: SplatNetFestTeamVotingStatus | null;
}
