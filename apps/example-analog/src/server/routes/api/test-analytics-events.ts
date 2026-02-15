import { defineEventHandler, getMethod, createError } from 'h3';
import { ensureInitialized, analytics, analyticsAdapter } from '../../utils/momentum-init';

export default defineEventHandler(async (event) => {
	if (process.env['NODE_ENV'] === 'production') {
		throw createError({ statusCode: 404, message: 'Not found' });
	}
	await ensureInitialized();
	const method = getMethod(event);

	if (method === 'GET') {
		// Flush pending events first so tests see them immediately
		await analytics.eventStore.flush();
		const result = await analyticsAdapter.query({ limit: 500 });
		return result;
	}
	if (method === 'DELETE') {
		analyticsAdapter.events.length = 0;
		return { cleared: true };
	}
	return { error: 'Method not allowed' };
});
