import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { CollectionConfig, MomentumConfig, UserContext } from '@momentumcms/core';
import { handlePreviewRequest } from './preview-handler';
import { initializeMomentumAPI, resetMomentumAPI } from './momentum-api';
import { createInMemoryAdapter } from './server-core';

const adminUser: UserContext = { id: 'admin', role: 'admin' };

const restrictedCollection: CollectionConfig = {
	slug: 'posts',
	fields: [{ name: 'title', type: 'text' }],
	access: {
		read: ({ req }) => req.user?.role === 'admin',
	},
};

const publicCollection: CollectionConfig = {
	slug: 'pages',
	fields: [{ name: 'title', type: 'text' }],
	access: { read: () => true },
};

function setup(collections: CollectionConfig[]): MomentumConfig {
	const config: MomentumConfig = {
		collections,
		db: { adapter: createInMemoryAdapter() },
	};
	initializeMomentumAPI(config);
	return config;
}

const noopRenderEmail = vi.fn().mockResolvedValue('<p>email</p>');

describe('handlePreviewRequest', () => {
	beforeEach(() => resetMomentumAPI());
	afterEach(() => resetMomentumAPI());

	it('returns 401 when no user is supplied', async () => {
		const config = setup([publicCollection]);
		const result = await handlePreviewRequest({
			config,
			collectionSlug: 'pages',
			id: '1',
			method: 'GET',
			renderEmail: noopRenderEmail,
		});
		expect(result.status).toBe(401);
		expect(result.body).toMatchObject({
			error: 'Authentication required to access preview',
		});
	});

	it('returns 404 when the collection does not exist', async () => {
		const config = setup([publicCollection]);
		const result = await handlePreviewRequest({
			config,
			collectionSlug: 'nonexistent',
			id: '1',
			method: 'GET',
			user: adminUser,
			renderEmail: noopRenderEmail,
		});
		expect(result.status).toBe(404);
		expect(result.body).toMatchObject({ error: 'Collection not found' });
	});

	it('returns 403 when access.read denies the user', async () => {
		const config = setup([restrictedCollection]);
		const result = await handlePreviewRequest({
			config,
			collectionSlug: 'posts',
			id: '1',
			method: 'GET',
			user: { id: 'editor-1', role: 'editor' },
			renderEmail: noopRenderEmail,
		});
		expect(result.status).toBe(403);
		expect(result.body).toMatchObject({ error: 'Access denied' });
	});

	it('returns 400 when POST body is missing the data field', async () => {
		const config = setup([publicCollection]);
		const result = await handlePreviewRequest({
			config,
			collectionSlug: 'pages',
			id: '1',
			method: 'POST',
			postBody: {},
			user: adminUser,
			renderEmail: noopRenderEmail,
		});
		expect(result.status).toBe(400);
		expect(result.body).toMatchObject({
			error: 'POST preview requires { data: ... } body',
		});
	});

	it('returns rendered HTML with content-type for a valid POST preview', async () => {
		const config = setup([publicCollection]);
		const result = await handlePreviewRequest({
			config,
			collectionSlug: 'pages',
			id: '1',
			method: 'POST',
			postBody: { data: { title: 'Live preview text' } },
			user: adminUser,
			renderEmail: noopRenderEmail,
		});
		expect(result.status).toBe(200);
		expect(result.headers?.['Content-Type']).toBe('text/html; charset=utf-8');
		expect(typeof result.body).toBe('string');
	});
});
