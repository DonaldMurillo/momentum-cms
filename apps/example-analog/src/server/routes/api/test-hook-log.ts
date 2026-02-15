import { defineEventHandler, getMethod } from 'h3';

import { getHookLog, clearHookLog } from '@momentum-cms/example-config';
import { ensureInitialized } from '../../utils/momentum-init';

export default defineEventHandler(async (event) => {
	await ensureInitialized();
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
