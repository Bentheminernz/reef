import * as Sentry from '@sentry/sveltekit';

Sentry.init({
	dsn: 'https://aa547479d44077740c03231d6ddd0860@o4512231178240000.ingest.us.sentry.io/4512231180730368',
	release: __GIT_SHA__,

	// Errors only for now; raise to something like 0.1 when you want performance tracing
	// (the free tier includes 5M spans/month).
	tracesSampleRate: 0,

	dataCollection: {
		// No user identity, cookies, headers, bodies, query params, or stack-frame locals leave
		// the box. See https://docs.sentry.io/platforms/javascript/configuration/options/#dataCollection
		userInfo: false,
		cookies: false,
		httpHeaders: false,
		httpBodies: [],
		urlQueryParams: false,
		graphQL: { document: false, variables: false },
		genAI: { inputs: false, outputs: false },
		databaseQueryData: false,
		queues: false,
		stackFrameVariables: false
	}
});
