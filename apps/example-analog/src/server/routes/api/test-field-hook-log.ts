import { defineEventHandler, getMethod } from 'h3';

import { ensureInitialized } from '../../utils/momentum-init';

export default defineEventHandler(async (event) => {
	await ensureInitialized();
	const method = getMethod(event);

	if (method === 'GET') {
		const { getFieldHookLog } = await import('@momentum-cms/example-config');
		const invocations = getFieldHookLog();
		return { invocations, count: invocations.length };
	}
	if (method === 'DELETE') {
		const { clearFieldHookLog } = await import('@momentum-cms/example-config');
		clearFieldHookLog();
		return { cleared: true };
	}
	return { error: 'Method not allowed' };
});
