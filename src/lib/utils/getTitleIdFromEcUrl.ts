// ported from nxapi so I can use it in views without a runtime error thing since nxapi is only shipped to server
function getTitleIdFromEcUrl(url: string) {
	const match = url.match(/^https:\/\/ec\.nintendo\.com\/apps\/([0-9a-f]{16})\//);
	return match?.[1] ?? null;
}

export default getTitleIdFromEcUrl;
