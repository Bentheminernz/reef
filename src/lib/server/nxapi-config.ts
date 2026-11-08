import type { CoralAuthData } from 'nxapi/coral';

interface NxapiConfigModule {
	default: {
		coral: Pick<CoralAuthData, 'znca_version'> | null;
	};
}

// nxapi doesn't export its remote config so i need to do a funky import method
export async function getCoralConfig(): Promise<NxapiConfigModule['default']['coral']> {
	const configUrl = new URL('../common/remote-config.js', import.meta.resolve('nxapi'));
	const { default: config }: NxapiConfigModule = await import(/* @vite-ignore */ configUrl.href);

	return config.coral;
}
