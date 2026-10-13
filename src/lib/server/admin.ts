import { env } from '$env/dynamic/private';

export function isAdmin(naId: string | null | undefined): boolean {
	if (naId == null) return false;

	return (env.ADMIN_NA_IDS ?? '').split(',').some((id) => id.trim() === naId);
}
