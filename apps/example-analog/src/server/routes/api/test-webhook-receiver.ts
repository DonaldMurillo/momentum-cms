import { defineEventHandler, getMethod, readBody, createError } from 'h3';
import { ensureInitialized } from '../../utils/momentum-init';
import { receivedWebhooks } from '../../utils/test-state';

export default defineEventHandler(async (event) => {
	if (process.env['NODE_ENV'] === 'production') {
		throw createError({ statusCode: 404, message: 'Not found' });
	}
	await ensureInitialized();
	const method = getMethod(event);

	if (method === 'POST') {
		const body = await readBody(event);
		const headers = Object.fromEntries(
			Object.entries(event.node.req.headers).filter(
				(entry): entry is [string, string] => typeof entry[1] === 'string',
			),
		);
		receivedWebhooks.push({
			headers,
			body,
			timestamp: Date.now(),
		});
		return { received: true };
	}
	if (method === 'GET') {
		return { webhooks: receivedWebhooks, count: receivedWebhooks.length };
	}
	if (method === 'DELETE') {
		receivedWebhooks.length = 0;
		return { cleared: true };
	}
	return { error: 'Method not allowed' };
});
