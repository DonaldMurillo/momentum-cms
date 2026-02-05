import { defineEventHandler, getRouterParams, getCookie, createError } from 'h3';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { initializeMomentumAPI, getMomentumAPI } from '@momentum-cms/server-core';
import momentumConfig from '../../../../momentum.config';
import { sessions } from '../../../utils/sessions';

// Initialize Momentum API on first request
let initialized = false;

/**
 * DELETE /api/media/:id
 * Delete a media document and its file.
 */
export default defineEventHandler(async (event) => {
	// Initialize Momentum API if not already done
	if (!initialized) {
		await momentumConfig.db.adapter.initialize?.(momentumConfig.collections);
		initializeMomentumAPI(momentumConfig);
		initialized = true;
	}

	// Check authentication
	const sessionId = getCookie(event, 'momentum_session');
	if (!sessionId) {
		throw createError({ statusCode: 401, message: 'Authentication required' });
	}

	const session = sessions.get(sessionId);
	if (!session) {
		throw createError({ statusCode: 401, message: 'Invalid session' });
	}

	const params = getRouterParams(event);
	const id = params['id'];

	if (!id) {
		throw createError({ statusCode: 400, message: 'Media ID required' });
	}

	const api = getMomentumAPI();
	const userApi = api.setContext({
		user: { id: session.userId, email: session.email, role: session.role },
	});

	try {
		// Get media document to find file path
		const doc = await userApi.collection<{ path?: string }>('media').findById(id);

		if (!doc) {
			throw createError({ statusCode: 404, message: 'Media not found' });
		}

		// Delete file from disk
		if (doc.path) {
			const uploadDir = join(process.cwd(), 'data', 'uploads');
			const fullPath = join(uploadDir, doc.path);
			if (existsSync(fullPath)) {
				unlinkSync(fullPath);
			}
		}

		// Delete document from database
		await userApi.collection('media').delete(id);

		return { id, deleted: true };
	} catch (error) {
		if (error && typeof error === 'object' && 'statusCode' in error) {
			throw error;
		}
		console.error('[Media] Delete error:', error);
		throw createError({ statusCode: 500, message: 'Failed to delete media' });
	}
});
