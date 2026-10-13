function decodeMpExternalAsset(assetKey: string): string {
	const prefix = 'mp:external/';
	if (!assetKey.startsWith(prefix)) {
		throw new Error(`Not an mp:external asset key: ${assetKey}`);
	}

	const afterPrefix = assetKey.slice(prefix.length);
	const hashEnd = afterPrefix.indexOf('/');
	if (hashEnd === -1) {
		throw new Error(`Malformed asset key (no hash separator): ${assetKey}`);
	}
	const encodedUrl = afterPrefix.slice(hashEnd + 1);

	const schemeMatch = encodedUrl.match(/^(https?)\/(.+)$/);
	if (!schemeMatch) {
		throw new Error(`Could not parse scheme from asset key: ${assetKey}`);
	}
	const [, scheme, rest] = schemeMatch;

	return `${scheme}://${rest}`;
}

export default decodeMpExternalAsset;
