import { version } from '$app/environment';

export const appInfo = {
	commit: __COMMIT__,
	buildTime: __BUILD_TIME__,
	deployId: version
};
