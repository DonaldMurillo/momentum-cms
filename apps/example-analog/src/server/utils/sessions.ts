/**
 * In-memory session store for demo/E2E testing.
 * In production, use a proper session store (Redis, database, etc.)
 */
if (process.env['NODE_ENV'] === 'production') {
	console.warn(
		'[Momentum] WARNING: Using in-memory session store in production. ' +
			'Sessions will be lost on restart and will not work in multi-instance deployments. ' +
			'Configure a persistent session store (Redis, database, etc.).',
	);
}

export const sessions = new Map<string, { userId: string; email: string; role: string }>();
