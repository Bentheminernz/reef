import { PresenceState } from 'nxapi/coral';
import type SplatNet3Api from 'nxapi/splatnet3';
import {
	BankaraMatchMode,
	CoopRule,
	FestMatchMode,
	FriendOnlineState
} from 'splatnet3-types/splatnet3';
import type { StageScheduleResult } from 'splatnet3-types/splatnet3';

import type { DiscordActivity } from '$lib/types/discord-auth';
import getTitleIdFromEcUrl from '$lib/utils/getTitleIdFromEcUrl';
import {
	setLargeImage,
	setSmallImage,
	type PresenceMonitor,
	type PresenceMonitorContext
} from './monitor';
import {
	splatnetFriendId,
	type SplatNetCoopSetting,
	type SplatNetDiscordActivityOptions,
	type SplatNetFest,
	type SplatNetFestVotingStatusResult,
	type SplatNetFriend,
	type SplatNetFriendWithIcon,
	type SplatNetScheduleItem,
	type SplatNetTimePeriod,
	type SplatNetVsSetting
} from '$lib/types/splatnet-monitor';
import cached from '$lib/utils/cached';

const SPLATOON_3_TITLE_ID = '0100c2500fc20000';

const SPLATNET_ASSET_IDS: Record<string, string> = {
	'mode-coop-teamcontest-1': '1555664780604342363',
	'mode-coop-regular-1': '1555664781468377170',
	'mode-coop-bigrun-1': '1555664781724225576',
	'mode-vs-bankara-2': '1555873412956557385',
	'mode-vs-regular-2': '1555873416211472394',
	'mode-fest-1': '1555873419424301116',
	'mode-vs-xmatch-2': '1555873511153868872',
	'mode-vs-private-1': '1555873567047024721'
};

export const stageImages = new Map<string, string>([
	[
		'VnNTdGFnZS0x',
		'https://assets.splatoon3.ink/splatnet/v3/stage_img/icon/high_resolution/35f9ca08ccc2bf759774ab2cb886567c117b9287875ca92fb590c1294ddcdc1e_0.png'
	], // Scorch Gorge
	[
		'VnNTdGFnZS0y',
		'https://assets.splatoon3.ink/splatnet/v3/stage_img/icon/high_resolution/898e1ae6c737a9d44552c7c81f9b710676492681525c514eadc68a6780aa52af_0.png'
	], // Eeltail Alley
	[
		'VnNTdGFnZS0z',
		'https://assets.splatoon3.ink/splatnet/v3/stage_img/icon/high_resolution/8dc2f16d39c630bab40cead5b2485ca3559e829d0d3de0c2232c7a62fefb5fa9_0.png'
	], // Hagglefish Market
	[
		'VnNTdGFnZS00',
		'https://assets.splatoon3.ink/splatnet/v3/stage_img/icon/high_resolution/9b1c17b2075479d0397d2fb96efbc6fa3a28900712920e5fe1e9dfc59c6abc5c_0.png'
	], // Undertow Spillway
	[
		'VnNTdGFnZS01',
		'https://assets.splatoon3.ink/splatnet/v3/stage_img/icon/high_resolution/f14c2a64e49d243679fc0884af91e1a07dc65600f9b90aefe92d7790dcffb191_0.png'
	], // Um'ami Ruins
	[
		'VnNTdGFnZS02',
		'https://assets.splatoon3.ink/splatnet/v3/stage_img/icon/high_resolution/de1f212e9ff0648f36cd3b8e0917ef36b3bd51445159297dcb948f34a09f2f05_0.png'
	], // Mincemeat Metalworks
	[
		'VnNTdGFnZS03',
		'https://assets.splatoon3.ink/splatnet/v3/stage_img/icon/high_resolution/cd84d711b47a424334569ac20f33f8e0ab6a652dc07854dcd36508a0081e9034_0.png'
	], // Brinewater Springs
	[
		'VnNTdGFnZS04',
		'https://assets.splatoon3.ink/splatnet/v3/stage_img/icon/high_resolution/f70e9f5af477a39ccfab631bfb81c9e2cedb4cd0947fe260847c214a6d23695f_0.png'
	], // Barnacle & Dime
	[
		'VnNTdGFnZS05',
		'https://assets.splatoon3.ink/splatnet/v3/stage_img/icon/high_resolution/488017f3ce712fca9fb37d61fe306343054449bb2d2bb1751d95f54a98564cae_0.png'
	], // Flounder Heights
	[
		'VnNTdGFnZS0xMA==',
		'https://assets.splatoon3.ink/splatnet/v3/stage_img/icon/high_resolution/1db8ab338b64b464df50e7f9e270e59423ff8caac6f09679a24f1b7acf3a82f3_0.png'
	], // Hammerhead Bridge
	[
		'VnNTdGFnZS0xMQ==',
		'https://assets.splatoon3.ink/splatnet/v3/stage_img/icon/high_resolution/b9d8cfa186d197a27e075600a107c99d9e21646d116730f0843e0fff0aaba7dd_0.png'
	], // Museum d'Alfonsino
	[
		'VnNTdGFnZS0xMg==',
		'https://assets.splatoon3.ink/splatnet/v3/stage_img/icon/high_resolution/8273118c1ffe1bf6fe031c7d8c9795dab52632c9b76e8e9f01f644ac5ae0ccc0_0.png'
	], // Mahi-Mahi Resort
	[
		'VnNTdGFnZS0xMw==',
		'https://assets.splatoon3.ink/splatnet/v3/stage_img/icon/high_resolution/40aba8b36a9439e2d670fde5b3478819ea8a94f9e503b9d783248a5716786f35_0.png'
	], // Inkblot Art Academy
	[
		'VnNTdGFnZS0xNA==',
		'https://assets.splatoon3.ink/splatnet/v3/stage_img/icon/high_resolution/48684c69d5c5a4ffaf16b712a4895545a8d01196115d514fc878ce99863bb3e9_0.png'
	], // Sturgeon Shipyard
	[
		'VnNTdGFnZS0xNQ==',
		'https://assets.splatoon3.ink/splatnet/v3/stage_img/icon/high_resolution/a8ba96c3dbd015b7bc6ea4fa067245c4e9aee62b6696cb41e02d35139dd21fe7_0.png'
	], // MakoMart
	[
		'VnNTdGFnZS0xNg==',
		'https://assets.splatoon3.ink/splatnet/v3/stage_img/icon/high_resolution/61ea801fa4ed32360dcaf83986222ded46a72dbf56194acc6d0cf4659a92ba85_0.png'
	], // Wahoo World
	[
		'VnNTdGFnZS0xNw==',
		'https://assets.splatoon3.ink/splatnet/v3/stage_img/icon/high_resolution/7b3cf118bd9f45d141cd6db0ee75b06e697fa83945c7fe1e6f8483de6a591f5f_0.png'
	], // Humpback Pump Track
	[
		'VnNTdGFnZS0xOA==',
		'https://assets.splatoon3.ink/splatnet/v3/stage_img/icon/high_resolution/0b7fd997781e03eb9d5bf1875ed070f698afc654f4fe929452c65aa26c0a35fd_0.png'
	], // Manta Maria
	[
		'VnNTdGFnZS0xOQ==',
		'https://assets.splatoon3.ink/splatnet/v3/stage_img/icon/high_resolution/4e0e9e2046aff1d635e23946d9f0a461486d2aab349079e551037e426ac82c7a_0.png'
	], // Crableg Capital
	[
		'VnNTdGFnZS0yMA==',
		'https://assets.splatoon3.ink/splatnet/v3/stage_img/icon/high_resolution/b65a70eedf129848b9d2b492bb68712abf91a5cbda13131848947fb04c51d665_0.png'
	], // Shipshape Cargo Co.
	[
		'VnNTdGFnZS0yMQ==',
		'https://assets.splatoon3.ink/splatnet/v3/stage_img/icon/high_resolution/692365fa7e56cf19cfa403a8546e69cf60fd9ca2171bde66cdaa53dc0e736ac9_0.png'
	], // Robo ROM-en
	[
		'VnNTdGFnZS0yMg==',
		'https://assets.splatoon3.ink/splatnet/v3/stage_img/icon/high_resolution/3e468df1f38d6323cc8d9446049696d66e47831e68cd31032502349b11960500_0.png'
	], // Bluefin Depot
	[
		'VnNTdGFnZS0yMw==',
		'https://assets.splatoon3.ink/splatnet/v3/stage_img/icon/high_resolution/21ea0549b3d29de56ec20affef8866297929d0defb82a27cd199c9d8dade508c_0.png'
	], // Marlin Airport
	[
		'VnNTdGFnZS0yNA==',
		'https://assets.splatoon3.ink/splatnet/v3/stage_img/icon/high_resolution/2ba481293efc554ac217f21b6d56dd08f9d66e72b286f20714abd5ef1520f47a_0.png'
	], // Lemuria Hub
	[
		'VnNTdGFnZS0yNg==',
		'https://assets.splatoon3.ink/splatnet/v3/stage_img/icon/high_resolution/249c981fdd888e79ada712ddf899bddbead508d71043af3ff96c90a7b5959c73_0.png'
	] // Urchin Underpass
]);

function assetImage(assetName: string): string {
	return SPLATNET_ASSET_IDS[assetName] ?? assetName;
}

const SCHEDULES_CACHE_TTL = 5 * 60 * 1000;
const FEST_VOTING_CACHE_TTL = 5 * 60 * 1000;

const schedulesCache = new Map<
	string,
	{ expiresAt: number; value: Promise<StageScheduleResult> }
>();
const festVotingStatusCache = new Map<
	string,
	{ expiresAt: number; value: Promise<SplatNetFestVotingStatusResult> }
>();

/**
 * SplatNet 3 presence monitor.
 * (inspired by nxapi)
 * refreshes the friend list, schedules and festival voting
 * status once per sync run in `update`, then alters the activity in
 * `callback` with their battle mode, rotation rule, stages and more.
 */
export class SplatNet3Monitor implements PresenceMonitor {
	readonly id = 'splatnet3';

	private friends: Map<string, SplatNetFriendWithIcon> | null = null;
	private schedules: StageScheduleResult | null = null;
	private fest: SplatNetFest | null = null;
	private festVotingStatus: SplatNetFestVotingStatusResult | null = null;

	constructor(private readonly api: SplatNet3Api) {}

	async update(): Promise<void> {
		const [friendsResult, schedules] = await Promise.all([
			this.api.getFriends(),
			cached(schedulesCache, this.api.na_country, SCHEDULES_CACHE_TTL, () =>
				this.api.getSchedules().then((result) => result.data)
			)
		]);

		this.friends = new Map(friendsResult.data.friends.nodes.map((friend) => [friend.id, friend]));
		this.schedules = schedules;
		this.fest = schedules.currentFest ?? null;

		const fest = this.fest;

		this.festVotingStatus =
			fest == null
				? null
				: await cached(
						festVotingStatusCache,
						`${this.api.na_country}:${fest.id}`,
						FEST_VOTING_CACHE_TTL,
						() => this.api.getFestVotingStatus(fest.id).then((result) => result.data)
					);
	}

	async callback(
		activity: DiscordActivity,
		context: PresenceMonitorContext
	): Promise<DiscordActivity | null> {
		if (!context.enabledWebServices.splatnet3) return null;

		const presence = context.coralFriend.presence;
		const titleId =
			presence.state === PresenceState.PLAYING || presence.state === PresenceState.ONLINE
				? getTitleIdFromEcUrl(presence.game.shopUri)
				: null;

		if (titleId !== SPLATOON_3_TITLE_ID) return null;

		const friend = this.friends?.get(splatnetFriendId(context.coralFriend.nsaId));
		if (friend == null || this.schedules == null) return null;

		const vs_setting =
			friend.vsMode == null ? null : getSettingForVsMode(this.schedules, friend.vsMode);
		const coop_setting =
			friend.coopRule == null
				? null
				: getSettingForCoopRule(this.schedules.coopGroupingSchedule, friend.coopRule);
		const fest_team_voting_status =
			this.festVotingStatus?.fest.teams.find((team) =>
				team.votes?.nodes.find((vote) => vote.userIcon.url === friend.userIcon.url)
			) ?? null;

		return buildSplatNetDiscordActivity(activity, friend, {
			vsSetting: vs_setting,
			coopSetting: coop_setting,
			fest: this.fest,
			festTeamVotingStatus: fest_team_voting_status
		});
	}
}

// splatnet3 activity callback. inspired by nxapi's implementation
export function buildSplatNetDiscordActivity(
	activity: DiscordActivity,
	friend: SplatNetFriend,
	options: SplatNetDiscordActivityOptions = {}
): DiscordActivity {
	const {
		vsSetting: setting = null,
		coopSetting = null,
		fest = null,
		festTeamVotingStatus = null
	} = options;

	// activity.state = activity.details;

	if (
		(friend.onlineState === FriendOnlineState.VS_MODE_MATCHING ||
			friend.onlineState === FriendOnlineState.VS_MODE_FIGHTING) &&
		friend.vsMode
	) {
		const mode_name =
			friend.vsMode.mode === 'REGULAR'
				? 'Regular Battle'
				: friend.vsMode.id === 'VnNNb2RlLTI='
					? 'Anarchy Battle (Series)' // VsMode-2
					: friend.vsMode.id === 'VnNNb2RlLTUx'
						? 'Anarchy Battle (Open)' // VsMode-51
						: friend.vsMode.mode === 'BANKARA'
							? 'Anarchy Battle'
							: friend.vsMode.id === 'VnNNb2RlLTY='
								? 'Splatfest Battle (Open)' // VsMode-6
								: friend.vsMode.id === 'VnNNb2RlLTc='
									? 'Splatfest Battle (Pro)' // VsMode-7
									: friend.vsMode.id === 'VnNNb2RlLTg='
										? 'Tricolour Battle' // VsMode-8
										: friend.vsMode.mode === 'FEST'
											? 'Splatfest Battle'
											: friend.vsMode.id === 'VnNNb2RlLTQ='
												? 'Challenge' // VsMode-4
												: friend.vsMode.mode === 'LEAGUE'
													? 'Challenge'
													: friend.vsMode.mode === 'X_MATCH'
														? 'X Battle' // VsMode-3
														: undefined;

		activity.details =
			(mode_name ?? friend.vsMode.name) +
			(friend.vsMode.mode === 'FEST' && festTeamVotingStatus
				? ' - Team ' + festTeamVotingStatus.teamName
				: '') +
			(friend.vsMode.mode === 'LEAGUE' && setting?.leagueMatchEvent
				? ': ' + setting.leagueMatchEvent.name
				: '') +
			(friend.vsMode.mode !== 'FEST' && friend.vsMode.mode !== 'LEAGUE' && setting
				? ' - ' + setting.vsRule.name
				: '') +
			(friend.onlineState === FriendOnlineState.VS_MODE_MATCHING ? ' (matching)' : '');

		if (friend.vsMode.id === 'VnNNb2RlLTg=' && fest?.tricolorStage) {
			const tricolour_stage_image = new URL(fest.tricolorStage.image.url);
			const match = tricolour_stage_image.pathname.match(/^\/resources\/prod\/(.+)$/);
			const proxy_stage_image =
				tricolour_stage_image.host === 'splatoon3.ink'
					? tricolour_stage_image.href
					: match
						? 'https://splatoon3.ink/assets/splatnet/' + match[1]
						: null;

			if (proxy_stage_image) {
				setLargeImage(activity, proxy_stage_image, fest.tricolorStage.name);
			}
		}

		if (setting) {
			// In the second half the player may be in a Tricolour battle if either:
			// the player is on the defending team and joins Splatfest Battle (Open) or
			// the player is on the attacking team and joins Tricolour Battle
			// const possibly_tricolour = fest?.state === FestState.SECOND_HALF && (
			//     (friend.vsMode.id === 'VnNNb2RlLTY=' && fest_team?.role === FestTeamRole.DEFENSE) ||
			//     (friend.vsMode.id === 'VnNNb2RlLTg=')
			// );
			// setLargeImage(
			// 	activity,
			// 	'https://fancy.org.uk/api/nxapi/s3/image?' +
			// 		new URLSearchParams({
			// 			a: setting.vsStages[0].id,
			// 			b: setting.vsStages[1].id,
			// 			// ...(possibly_tricolour ? {t: fest?.tricolorStage.id} : {}),
			// 			v: '2022092400'
			// 		}).toString(),
			// 	setting.vsStages.map((s) => s.name).join('/')
			// );
			//
			const stage_image = stageImages.get(setting.vsStages[0].id);
			if (stage_image) {
				setLargeImage(activity, stage_image, setting.vsStages.map((stage) => stage.name).join('/'));
			}
		}

		const mode_image =
			// Need to figure out my own s3 icon server
			// friend.vsMode.mode === 'FEST' && fest
			// 	? 'https://fancy.org.uk/api/nxapi/s3/fest-icon?' +
			// 		new URLSearchParams({
			// 			id: fest.id,
			// 			v: '2023060401'
			// 		}).toString()
			//              :
			friend.vsMode.mode === 'REGULAR'
				? assetImage('mode-vs-regular-2')
				: friend.vsMode.mode === 'BANKARA'
					? assetImage('mode-vs-bankara-2')
					: friend.vsMode.mode === 'FEST'
						? assetImage('mode-fest-1')
						: friend.vsMode.mode === 'LEAGUE' // TODO: Fetch League Icon
							? assetImage('mode-vs-event-1')
							: friend.vsMode.mode === 'X_MATCH'
								? assetImage('mode-vs-xmatch-2')
								: friend.vsMode.mode === 'PRIVATE'
									? assetImage('mode-vs-private-1')
									: undefined;

		if (mode_image) {
			setSmallImage(activity, mode_image, mode_name ?? friend.vsMode.name);
		}
	}

	if (
		friend.onlineState === FriendOnlineState.COOP_MODE_MATCHING ||
		friend.onlineState === FriendOnlineState.COOP_MODE_FIGHTING
	) {
		activity.details =
			'Salmon Run' +
			(friend.onlineState === FriendOnlineState.COOP_MODE_MATCHING ? ' (matching)' : '');

		if (coopSetting) {
			const coop_stage_image = new URL(coopSetting.coopStage.image.url);
			const match = coop_stage_image.pathname.match(/^\/resources\/prod\/(.+)$/);
			const proxy_stage_image =
				coop_stage_image.host === 'splatoon3.ink'
					? coop_stage_image.href
					: match
						? 'https://splatoon3.ink/assets/splatnet/' + match[1]
						: null;

			if (proxy_stage_image) {
				setLargeImage(activity, proxy_stage_image, coopSetting.coopStage.name);
			}
		}

		if (friend.coopRule === CoopRule.REGULAR) {
			setSmallImage(activity, assetImage('mode-coop-regular-1'), 'Salmon Run');
		}
		if (friend.coopRule === CoopRule.BIG_RUN) {
			setSmallImage(activity, assetImage('mode-coop-bigrun-1'), 'Big Run');
		}
		if (friend.coopRule === CoopRule.TEAM_CONTEST) {
			setSmallImage(activity, assetImage('mode-coop-teamcontest-1'), 'Eggstra Work');
		}
	}

	if (friend.onlineState === FriendOnlineState.MINI_GAME_PLAYING) {
		activity.details = 'Tableturf Battle';
	}

	return activity;
}

function isPeriodCurrent(period: SplatNetTimePeriod, now: number): boolean {
	const start = new Date(period.startTime).getTime();
	const end = new Date(period.endTime).getTime();

	return start < now && end >= now;
}

/**
 * Port of nxapi's `getSchedule` helper: the currently running schedule from a
 * schedule connection or node list, or null if there is no current schedule.
 */
export function getSchedule<T extends SplatNetScheduleItem>(
	schedules: { nodes: T[] } | T[] | null | undefined
): T | null {
	if (schedules == null) return null;

	const nodes = 'nodes' in schedules ? schedules.nodes : schedules;
	const now = Date.now();

	for (const schedule of nodes) {
		if (schedule.timePeriods) {
			for (const time_period of schedule.timePeriods) {
				if (isPeriodCurrent(time_period, now)) return schedule;
			}
		} else if (schedule.startTime != null && schedule.endTime != null) {
			if (isPeriodCurrent({ startTime: schedule.startTime, endTime: schedule.endTime }, now)) {
				return schedule;
			}
		}
	}

	return null;
}

/**
 * Port of nxapi's `getSettingForVsMode` helper: the current rotation's VS
 * setting for the given battle mode.
 */
export function getSettingForVsMode(
	schedules: StageScheduleResult,
	vs_mode: { id: string; mode: string }
): SplatNetVsSetting | null {
	if (vs_mode.mode === 'REGULAR') {
		return getSchedule(schedules.regularSchedules)?.regularMatchSetting ?? null;
	}

	if (vs_mode.mode === 'BANKARA') {
		const settings = getSchedule(schedules.bankaraSchedules)?.bankaraMatchSettings;

		if (vs_mode.id === 'VnNNb2RlLTI=') {
			// VsMode-2
			return (
				settings?.find((setting) => setting.bankaraMode === BankaraMatchMode.CHALLENGE) ?? null
			);
		}
		if (vs_mode.id === 'VnNNb2RlLTUx') {
			// VsMode-51
			return settings?.find((setting) => setting.bankaraMode === BankaraMatchMode.OPEN) ?? null;
		}
	}

	if (vs_mode.mode === 'FEST') {
		const settings = getSchedule(schedules.festSchedules)?.festMatchSettings as
			| (SplatNetVsSetting & { festMode: FestMatchMode | keyof typeof FestMatchMode })[]
			| null
			| undefined;

		if (vs_mode.id === 'VnNNb2RlLTY=') {
			return settings?.find((setting) => setting.festMode === FestMatchMode.REGULAR) ?? null;
		}
		if (vs_mode.id === 'VnNNb2RlLTc=') {
			return settings?.find((setting) => setting.festMode === FestMatchMode.CHALLENGE) ?? null;
		}
	}

	if (vs_mode.mode === 'LEAGUE') {
		return getSchedule(schedules.eventSchedules)?.leagueMatchSetting ?? null;
	}

	if (vs_mode.mode === 'X_MATCH') {
		return getSchedule(schedules.xSchedules)?.xMatchSetting ?? null;
	}

	return null;
}

/** Port of nxapi's `getSettingForCoopRule` helper: the current Salmon Run setting. */
export function getSettingForCoopRule(
	schedules: StageScheduleResult['coopGroupingSchedule'],
	coop_rule: string
): SplatNetCoopSetting | null {
	if (coop_rule === CoopRule.REGULAR) {
		return getSchedule(schedules.regularSchedules)?.setting ?? null;
	}

	if (coop_rule === CoopRule.BIG_RUN) {
		return getSchedule(schedules.bigRunSchedules)?.setting ?? null;
	}

	if (coop_rule === CoopRule.TEAM_CONTEST) {
		return getSchedule(schedules.teamContestSchedules)?.setting ?? null;
	}

	return null;
}
