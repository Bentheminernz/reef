export function timeAgo(unixSeconds: number): string {
	const seconds = Math.floor(Date.now() / 1000) - unixSeconds;

	const intervals: [string, number][] = [
		['Year', 31536000],
		['Month', 2592000],
		['Week', 604800],
		['Day', 86400],
		['hr', 3600],
		['min', 60]
	];

	if (seconds < 60) return 'just now';

	for (const [label, secs] of intervals) {
		const count = Math.floor(seconds / secs);
		if (count >= 1) {
			return `${count} ${label}${count > 1 ? 's' : ''} ago`;
		}
	}
	return 'just now';
}
