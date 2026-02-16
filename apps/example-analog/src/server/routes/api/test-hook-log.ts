import { defineEventHandler, getMethod, createError } from 'h3';

import { ensureInitialized } from '../../utils/momentum-init';

export default defineEventHandler(async (event) => {
	if (process.env['NODE_ENV'] === 'production') {
		throw createError({ statusCode: 404, message: 'Not found' });
	}
	await ensureInitialized();
	const { getHookLog, clearHookLog } = await import('@momentumcms/example-config');
	const method = getMethod(event);

	if (method === 'GET') {
		const invocations = getHookLog();
		return { invocations, count: invocations.length };
	}
	if (method === 'DELETE') {
		clearHookLog();
		return { cleared: true };
	}
	return { error: 'Method not allowed' };
});
