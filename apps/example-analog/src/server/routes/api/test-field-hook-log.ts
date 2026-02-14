import { defineEventHandler, getMethod } from 'h3';
import { getFieldHookLog, clearFieldHookLog } from '@momentum-cms/example-config';
import { ensureInitialized } from '../../utils/momentum-init';

export default defineEventHandler(async (event) => {
	await ensureInitialized();
	const method = getMethod(event);

	if (method === 'GET') {
		const invocations = getFieldHookLog();
		return { invocations, count: invocations.length };
	}
	if (method === 'DELETE') {
		clearFieldHookLog();
		return { cleared: true };
	}
});
