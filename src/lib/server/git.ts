import { execSync } from 'node:child_process';

export default function git(args: string, fallback: string) {
	try {
		return execSync(`git ${args}`).toString().trim();
	} catch {
		return fallback;
	}
}
