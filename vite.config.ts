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

const commit = process.env.GIT_SHA || git('rev-parse HEAD', 'unknown');

export default defineConfig({
	ssr: {
		external: ['@libsql/client', 'nxapi', 'nxapi/coral', 'nxapi/nintendo-account']
	},
	plugins: [
		sentrySvelteKit({
			org: 'reef-2s',
			project: 'javascript-sveltekit',
			release: { name: commit }
		}),
		tailwindcss(),
		sveltekit({
			compilerOptions: {
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
				name: commit,
				pollInterval: 60_000
			},
			experimental: {
				instrumentation: {
					server: true
				}
			}
		})
	],
	build: {
		sourcemap: true
	},
	define: {
		__GIT_SHA__: JSON.stringify(commit),
		__COMMIT__: JSON.stringify(commit.slice(0, 7)),
		__BUILD_TIME__: JSON.stringify(new Date().toISOString())
	},
	server: {
		allowedHosts: ['reefpresence.app']
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
