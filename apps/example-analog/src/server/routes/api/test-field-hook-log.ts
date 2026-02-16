import { defineEventHandler, getMethod, createError } from 'h3';

import { ensureInitialized } from '../../utils/momentum-init';

export default defineEventHandler(async (event) => {
	if (process.env['NODE_ENV'] === 'production') {
		throw createError({ statusCode: 404, message: 'Not found' });
	}
	await ensureInitialized();
	const method = getMethod(event);

	if (method === 'GET') {
		const { getFieldHookLog } = await import('@momentumcms/example-config');
		const invocations = getFieldHookLog();
		return { invocations, count: invocations.length };
	}
	if (method === 'DELETE') {
		const { clearFieldHookLog } = await import('@momentumcms/example-config');
		clearFieldHookLog();
		return { cleared: true };
	}
	return { error: 'Method not allowed' };
});
