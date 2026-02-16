import { defineEventHandler } from 'h3';
import { ensureInitialized } from '../utils/momentum-init';

/**
 * Nitro middleware that ensures Momentum CMS is fully initialized
 * before handling any request (API routes AND SSR page renders).
 *
 * Named with "00-" prefix to guarantee execution before other middleware
 * (Nitro loads middleware in alphabetical order).
 */
export default defineEventHandler(async () => {
	await ensureInitialized();
});
