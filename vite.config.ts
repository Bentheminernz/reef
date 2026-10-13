import { sentrySvelteKit } from '@sentry/sveltekit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { execSync } from 'node:child_process';

function git(args: string, fallback: string) {
	try {
		return execSync(`git ${args}`).toString().trim();
	} catch {
		return fallback;
	}
}

export default defineConfig({
	ssr: {
		external: ['@libsql/client', 'nxapi', 'nxapi/coral', 'nxapi/nintendo-account']
	},
	plugins: [
		sentrySvelteKit({
			org: 'reef-2s',
			project: 'javascript-sveltekit'
		}),
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			adapter: adapter(),

			typescript: {
				config: (config) => {
					config.include.push('../drizzle.config.ts');
				}
			},
			version: {
				name: git('rev-parse HEAD', Date.now().toString()),
				pollInterval: 60_000
			},
			// Sentry initializes server-side from src/instrumentation.server.ts (SvelteKit >= 2.31).
			experimental: {
				instrumentation: {
					server: true
				}
			}
		})
	],
	define: {
		__COMMIT__: JSON.stringify(git('rev-parse --short HEAD', 'unknown')),
		__BUILD_TIME__: JSON.stringify(new Date().toISOString())
	},
	server: {
		allowedHosts: ['native-arising-hammer-saturday.trycloudflare.com', 'reefpresence.app']
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
