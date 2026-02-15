import { defineEventHandler, getMethod, readBody, createError } from 'h3';

import type { HookBehaviorConfig } from '@momentum-cms/example-config';
import { ensureInitialized } from '../../utils/momentum-init';

export default defineEventHandler(async (event) => {
	const { getHookBehavior, setHookBehavior } = await import('@momentum-cms/example-config');
	await ensureInitialized();
	const method = getMethod(event);

	if (method === 'GET') {
		return getHookBehavior();
	}
	if (method === 'POST') {
		const body = await readBody(event);
		if (!body || typeof body !== 'object') {
			throw createError({ statusCode: 400, message: 'Invalid request body' });
		}
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Test infrastructure, validated above
		setHookBehavior(body as HookBehaviorConfig);
		return { configured: true };
	}
	return { error: 'Method not allowed' };
});
