import { defineEventHandler, getQuery } from 'h3';
import { ensureInitialized, getIsReady, getSeedingStatus } from '../../utils/momentum-init';

/**
 * GET /api/health
 * Health endpoint for E2E tests and monitoring.
 * Supports ?checkSeeds=true to wait for initialization before responding.
 */
export default defineEventHandler(async (event) => {
	const query = getQuery(event);

	// Wait for initialization if checkSeeds is requested
	if (query['checkSeeds'] === 'true') {
		try {
			await ensureInitialized();
		} catch {
			// Initialization failed, continue to return error status
		}
	}

	const ready = getIsReady();
	const seeds = getSeedingStatus();

	return {
		status: ready ? 'ok' : 'initializing',
		ready,
		seeds,
	};
});
