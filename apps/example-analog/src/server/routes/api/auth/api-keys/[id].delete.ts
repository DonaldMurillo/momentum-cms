/**
 * DELETE /api/auth/api-keys/:id — delete an API key.
 *
 * Admin can delete any key; non-admin can only delete their own.
 */

import { defineEventHandler, getRouterParam, getHeaders, setResponseStatus } from 'h3';
import { createAdapterApiKeyStore } from '@momentumcms/server-core';
import { ensureInitialized } from '../../../../utils/momentum-init';
import { resolveUserFromRequest } from '../../../../utils/resolve-user';
import momentumConfig from '../../../../../momentum.config';

let store: ReturnType<typeof createAdapterApiKeyStore> | null = null;

function getStore(): ReturnType<typeof createAdapterApiKeyStore> {
	if (!store) {
		store = createAdapterApiKeyStore(momentumConfig.db.adapter);
	}
	return store;
}

export default defineEventHandler(async (event) => {
	await ensureInitialized();

	const rawHeaders = getHeaders(event);
	const user = await resolveUserFromRequest(rawHeaders, getStore());
	if (!user) {
		setResponseStatus(event, 401);
		return { error: 'Unauthorized' };
	}

	const keyId = getRouterParam(event, 'id');
	if (!keyId) {
		setResponseStatus(event, 400);
		return { error: 'Key ID required' };
	}

	const apiKeyStore = getStore();

	// Non-admin users can only delete their own keys
	if (user.role !== 'admin') {
		const existingKey = await apiKeyStore.findById(keyId);
		if (!existingKey) {
			setResponseStatus(event, 404);
			return { error: 'API key not found' };
		}
		if (existingKey.createdBy !== user.id) {
			// Return 404 (not 403) to prevent API key ID enumeration
			setResponseStatus(event, 404);
			return { error: 'API key not found' };
		}
	}

	try {
		const deleted = await apiKeyStore.deleteById(keyId);
		if (deleted) {
			return { deleted: true };
		}
		setResponseStatus(event, 404);
		return { error: 'API key not found' };
	} catch {
		setResponseStatus(event, 500);
		return { error: 'Failed to delete API key' };
	}
});
