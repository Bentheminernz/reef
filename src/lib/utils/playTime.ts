export function formatPlayTime(totalMinutes: number, firstPlay?: number): string {
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	const parts: string[] = [];
	let firstPlayString = '';

	if (hours > 0) {
		parts.push(`${hours.toLocaleString()} ${hours === 1 ? 'hr' : 'hrs'}`);
	}

	if (minutes > 0) {
		parts.push(`${minutes} ${minutes === 1 ? 'min' : 'mins'}`);
	}

	if (firstPlay) {
		const date = new Date(firstPlay * 1000);
		firstPlayString = new Intl.DateTimeFormat('en-GB', {
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		}).format(date);
	}

	return `Played for ${parts.length > 0 ? parts.join(' ') : '0 mins'}${firstPlayString !== '' ? ` since ${firstPlayString}` : ''}`;
}

export function timeAgo(unixSeconds: number) {
	const seconds = Math.floor(Date.now() / 1000) - unixSeconds;

	if (seconds < 60) return 'just now';

	const intervals: [string, number][] = [
		['day', 86400],
		['hr', 3600],
		['min', 60]
	];

	for (const [label, interval] of intervals) {
		const count = Math.floor(seconds / interval);

		if (count >= 1) {
			return `${count} ${label}${count === 1 ? '' : 's'} ago`;
		}
	}

	return 'just now';
}
