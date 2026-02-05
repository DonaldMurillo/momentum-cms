import { defineEventHandler, readMultipartFormData, getCookie, createError } from 'h3';
import { randomUUID } from 'crypto';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { initializeMomentumAPI, getMomentumAPI } from '@momentum-cms/server-core';
import momentumConfig from '../../../../momentum.config';
import { sessions } from '../../../utils/sessions';

// Initialize Momentum API on first request
let initialized = false;

/**
 * POST /api/media/upload
 * Handle file uploads.
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

	// Parse multipart form data
	const formData = await readMultipartFormData(event);
	if (!formData || formData.length === 0) {
		throw createError({ statusCode: 400, message: 'No file uploaded' });
	}

	const fileField = formData.find((f) => f.name === 'file');
	if (!fileField || !fileField.data) {
		throw createError({ statusCode: 400, message: 'No file in upload' });
	}

	const filename = fileField.filename ?? 'upload';
	const mimeType = fileField.type ?? 'application/octet-stream';
	const fileData = fileField.data;

	// Generate unique path
	const fileId = randomUUID();
	const extension = filename.split('.').pop() ?? '';
	const storagePath = `${fileId}.${extension}`;

	// Ensure upload directory exists
	const uploadDir = join(process.cwd(), 'data', 'uploads');
	if (!existsSync(uploadDir)) {
		mkdirSync(uploadDir, { recursive: true });
	}

	// Write file to disk
	const fullPath = join(uploadDir, storagePath);
	writeFileSync(fullPath, fileData);

	// Create media document in database
	const api = getMomentumAPI();
	const userApi = api.setContext({
		user: { id: session.userId, email: session.email, role: session.role },
	});

	try {
		const doc = await userApi.collection('media').create({
			filename,
			mimeType,
			filesize: fileData.length,
			path: storagePath,
			url: `/api/media/file/${storagePath}`,
		});

		return { doc };
	} catch (error) {
		console.error('[Media] Upload error:', error);
		throw createError({ statusCode: 500, message: 'Failed to create media document' });
	}
});
