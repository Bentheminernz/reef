function cached<T>(
	cache: Map<string, { expiresAt: number; value: Promise<T> }>,
	key: string,
	ttl: number,
	load: () => Promise<T>
): Promise<T> {
	const now = Date.now();
	const existing = cache.get(key);

	if (existing && existing.expiresAt > now) {
		return existing.value;
	}

	const value = load();
	const entry = { expiresAt: now + ttl, value };

	cache.set(key, entry);
	void value.catch(() => {
		if (cache.get(key) === entry) {
			cache.delete(key);
		}
	});

	return value;
}

export default cached;
