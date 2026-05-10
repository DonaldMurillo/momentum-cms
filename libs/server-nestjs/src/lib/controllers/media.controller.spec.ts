import 'reflect-metadata';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MediaController } from './media.controller';
import { MomentumApiService } from '../momentum-api.service';
import { MOMENTUM_CONFIG } from '../momentum-config.token';
import { resetMomentumAPI, initializeMomentumAPI } from '@momentumcms/server-core';
import type { MomentumConfig, StorageAdapter } from '@momentumcms/core';
import { createTestConfig, unversionedCollection } from '../__test-utils__/fixtures';

interface RecordingStorage extends StorageAdapter {
	readCalls: string[];
}

function createRecordingStorage(files: Record<string, Uint8Array>): RecordingStorage {
	const readCalls: string[] = [];
	return {
		readCalls,
		upload: async () => ({ path: '', filename: '', mimeType: '', size: 0, url: '' }),
		delete: async () => true,
		getUrl: () => '',
		exists: async (path) => path in files,
		read: async (path) => {
			readCalls.push(path);
			return files[path] ?? null;
		},
	};
}

describe('MediaController', () => {
	let app: INestApplication;

	beforeEach(async () => {
		resetMomentumAPI();
		const config = createTestConfig([unversionedCollection]);
		initializeMomentumAPI(config);

		const module = await Test.createTestingModule({
			controllers: [MediaController],
			providers: [MomentumApiService, { provide: MOMENTUM_CONFIG, useValue: config }],
		}).compile();

		app = module.createNestApplication();
		await app.init();
	});

	afterEach(async () => {
		await app.close();
		resetMomentumAPI();
	});

	it('GET /media/file/* returns 500 when storage is not configured', async () => {
		const res = await request(app.getHttpServer()).get('/media/file/foo.jpg');
		expect(res.status).toBe(500);
		expect(res.body.error).toBe('Storage not configured');
	});

	it('POST /media/upload returns 401 without an authenticated user', async () => {
		const res = await request(app.getHttpServer()).post('/media/upload').send({ alt: 'x' });
		expect(res.status).toBe(401);
		expect(res.body.error).toBe('Authentication required to upload files');
	});
});

describe('MediaController GET /media/file/* (wildcard extraction)', () => {
	let app: INestApplication;
	let storage: RecordingStorage;

	beforeEach(async () => {
		resetMomentumAPI();
		storage = createRecordingStorage({
			'foo.jpg': new Uint8Array([0x68, 0x69]),
			'nested/dir/photo.png': new Uint8Array([0x42, 0x43, 0x44]),
		});
		const config: MomentumConfig = {
			collections: [unversionedCollection],
			db: createTestConfig([unversionedCollection]).db,
			storage: { adapter: storage },
		};
		initializeMomentumAPI(config);

		const module = await Test.createTestingModule({
			controllers: [MediaController],
			providers: [MomentumApiService, { provide: MOMENTUM_CONFIG, useValue: config }],
		}).compile();

		app = module.createNestApplication();
		await app.init();
	});

	afterEach(async () => {
		await app.close();
		resetMomentumAPI();
	});

	it('forwards the wildcard segment to the storage adapter and streams the file', async () => {
		const res = await request(app.getHttpServer()).get('/media/file/foo.jpg');
		expect(res.status).toBe(200);
		expect(storage.readCalls).toContain('foo.jpg');
		expect(Buffer.from(res.body).equals(Buffer.from([0x68, 0x69]))).toBe(true);
	});

	it('forwards Content-Type from handler.headers (not just body.mimeType) and sets Cache-Control', async () => {
		// Regression guard: the controller must propagate every header the
		// shared handler returns, not re-derive Content-Type from the body
		// payload. If a future handler change adds e.g. Content-Disposition
		// or ETag, this test ensures the NestJS path doesn't silently drop it.
		const res = await request(app.getHttpServer()).get('/media/file/foo.jpg');
		expect(res.status).toBe(200);
		expect(res.headers['content-type']).toBeDefined();
		expect(res.headers['cache-control']).toBe('public, max-age=31536000');
	});

	it('forwards multi-segment wildcard paths verbatim (proves req.params[0] captures all segments)', async () => {
		const res = await request(app.getHttpServer()).get('/media/file/nested/dir/photo.png');
		expect(res.status).toBe(200);
		expect(storage.readCalls).toContain('nested/dir/photo.png');
	});

	it('returns 404 when the wildcard path does not resolve to a stored file', async () => {
		const res = await request(app.getHttpServer()).get('/media/file/missing.jpg');
		expect(res.status).toBe(404);
		expect(storage.readCalls).toContain('missing.jpg');
	});
});
