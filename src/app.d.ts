// See https://svelte.dev/docs/kit/types#app.d.ts

import type { nintendoAccount } from '$lib/server/db/schema';

// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			nintendoAccount?: typeof nintendoAccount.$inferSelect;
			isAdmin: boolean;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
