import 'reflect-metadata';
import { describe, it, expect, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AccessController } from './access.controller';
import { MomentumApiService } from '../momentum-api.service';
import { MOMENTUM_CONFIG } from '../momentum-config.token';
import { resetMomentumAPI, createInMemoryAdapter } from '@momentumcms/server-core';
import type { MomentumConfig, CollectionConfig } from '@momentumcms/core';

const publicCollection: CollectionConfig = {
	slug: 'posts',
	fields: [{ name: 'title', type: 'text', required: true }],
};

const restrictedCollection: CollectionConfig = {
	slug: 'secrets',
	fields: [{ name: 'content', type: 'text' }],
	access: {
		create: ({ user }) => !!user,
		read: () => true,
		update: ({ user }) => !!user,
		delete: ({ user }) => !!user,
	},
};

const adminOnlyCollection: CollectionConfig = {
	slug: 'admin-settings',
	fields: [{ name: 'value', type: 'text' }],
	access: {
		create: ({ user }) => user?.role === 'admin',
		read: ({ user }) => user?.role === 'admin',
		update: ({ user }) => user?.role === 'admin',
		delete: ({ user }) => user?.role === 'admin',
	},
};

function createTestConfig(collections: CollectionConfig[]): MomentumConfig {
	return {
		collections,
		db: { adapter: createInMemoryAdapter() },
		server: { port: 4000 },
	} as MomentumConfig;
}

describe('AccessController', () => {
	let app: INestApplication;

	afterEach(async () => {
		await app.close();
		resetMomentumAPI();
	});

	async function createApp(collections: CollectionConfig[]): Promise<void> {
		resetMomentumAPI();

		const module = await Test.createTestingModule({
			controllers: [AccessController],
			providers: [
				MomentumApiService,
				{ provide: MOMENTUM_CONFIG, useValue: createTestConfig(collections) },
			],
		}).compile();

		app = module.createNestApplication();
		await app.init();
	}

	it('GET /access should return permissions for each collection', async () => {
		await createApp([publicCollection, restrictedCollection]);

		const res = await request(app.getHttpServer()).get('/access');
		expect(res.status).toBe(200);
		expect(res.body.collections).toBeDefined();
		expect(res.body.collections).toHaveLength(2);

		const slugs = res.body.collections.map((c: { slug: string }) => c.slug);
		expect(slugs).toContain('posts');
		expect(slugs).toContain('secrets');
	});

	it('GET /access should return individual collection permission fields', async () => {
		await createApp([publicCollection]);

		const res = await request(app.getHttpServer()).get('/access');
		expect(res.status).toBe(200);

		const posts = res.body.collections[0];
		expect(posts.slug).toBe('posts');
		expect(typeof posts.canCreate).toBe('boolean');
		expect(typeof posts.canRead).toBe('boolean');
		expect(typeof posts.canUpdate).toBe('boolean');
		expect(typeof posts.canDelete).toBe('boolean');
	});

	it('GET /access without user should deny write access on restricted collections', async () => {
		await createApp([restrictedCollection]);

		const res = await request(app.getHttpServer()).get('/access');
		expect(res.status).toBe(200);

		const secrets = res.body.collections[0];
		expect(secrets.slug).toBe('secrets');
		expect(secrets.canRead).toBe(true);
		expect(secrets.canCreate).toBe(false);
		expect(secrets.canUpdate).toBe(false);
		expect(secrets.canDelete).toBe(false);
	});

	it('GET /access without user should deny all access on admin-only collections', async () => {
		await createApp([adminOnlyCollection]);

		const res = await request(app.getHttpServer()).get('/access');
		expect(res.status).toBe(200);

		const adminSettings = res.body.collections[0];
		expect(adminSettings.slug).toBe('admin-settings');
		expect(adminSettings.canRead).toBe(false);
		expect(adminSettings.canCreate).toBe(false);
		expect(adminSettings.canUpdate).toBe(false);
		expect(adminSettings.canDelete).toBe(false);
	});

	it('GET /access should return permissions for multiple collections with mixed access', async () => {
		await createApp([publicCollection, restrictedCollection, adminOnlyCollection]);

		const res = await request(app.getHttpServer()).get('/access');
		expect(res.status).toBe(200);
		expect(res.body.collections).toHaveLength(3);

		const bySlug = Object.fromEntries(
			res.body.collections.map((c: { slug: string }) => [c.slug, c]),
		);

		// Public collection — no access control, defaults allow unauthenticated read
		expect(bySlug['posts'].canRead).toBe(true);

		// Restricted — read is public, write requires auth
		expect(bySlug['secrets'].canRead).toBe(true);
		expect(bySlug['secrets'].canCreate).toBe(false);

		// Admin-only — all denied for unauthenticated
		expect(bySlug['admin-settings'].canRead).toBe(false);
		expect(bySlug['admin-settings'].canCreate).toBe(false);
	});
});
