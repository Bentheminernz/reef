import 'dotenv/config';
import { SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'node:crypto';
import { db } from '$lib/server/db';
import { sessions } from '$lib/server/db/schema';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_KEY);
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export async function createSession(nintendoAccountId: string) {
	const sessionId = randomUUID();
	const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

	await db.insert(sessions).values({
		id: sessionId,
		nintendoAccountId,
		expiresAt
	});

	const jwt = await new SignJWT({ sid: sessionId })
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setExpirationTime(expiresAt)
		.sign(JWT_SECRET);

	return jwt;
}

export async function verifySession(jwt: string) {
	try {
		const { payload } = await jwtVerify(jwt, JWT_SECRET);
		return payload.sid as string;
	} catch {
		return null;
	}
}
