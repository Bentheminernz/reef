const FRIEND_CODE_URL = /friendcode\/(\d{4}-\d{4}-\d{4})/;

function formatFriendCode(value: string) {
	const urlMatch = value.match(FRIEND_CODE_URL);
	if (urlMatch) return urlMatch[1];

	return value
		.replace(/\D/g, '')
		.replace(/^(\d{4})/, '$1-')
		.replace(/^(\d{4}-\d{4})/, '$1-')
		.slice(0, 14);
}

export default formatFriendCode;
