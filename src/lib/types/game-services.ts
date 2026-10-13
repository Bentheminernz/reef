export interface GameService {
	id: number;
	uri: string;
	whiteList: string[];
	name: string;
	imageUri: string;
}

export interface GameServiceSession {
	sessionId: string;
	webviewUrl: string;
	expiresAt: number;
}
