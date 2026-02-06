import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { initializeMomentum, createHealthMiddleware } from './init-helpers';
import type { MomentumConfig, CollectionConfig, DatabaseAdapter } from '@momentum-cms/core';
import type { SeedingConfig } from '@momentum-cms/core';

// Mock server-core module
vi.mock('@momentum-cms/server-core', () => ({
	initializeMomentumAPI: vi.fn(),
	runSeeding: vi.fn().mockResolvedValue({
		created: 2,
		updated: 1,
		skipped: 1,
		total: 4,
		seeds: [],
	}),
	shouldRunSeeding: vi.fn((value) => value === true || value === 'always'),
}));

// Import mocked functions for assertions
import { initializeMomentumAPI, runSeeding, shouldRunSeeding } from '@momentum-cms/server-core';

// Mock collection for testing
const mockCollection: CollectionConfig = {
	slug: 'posts',
	labels: { singular: 'Post', plural: 'Posts' },
	fields: [{ name: 'title', type: 'text', required: true, label: 'Title' }],
};

// Mock database adapter
function createMockAdapter(withInitialize = true): DatabaseAdapter {
	return {
		find: vi.fn().mockResolvedValue([]),
		findById: vi.fn().mockResolvedValue(null),
		create: vi.fn().mockResolvedValue({ id: '1' }),
		update: vi.fn().mockResolvedValue({ id: '1' }),
		delete: vi.fn().mockResolvedValue(true),
		...(withInitialize && {
			initialize: vi.fn().mockResolvedValue(undefined),
		}),
	};
}

describe('initializeMomentum', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('basic initialization', () => {
		it('should initialize API without seeding when not configured', async () => {
			const adapter = createMockAdapter();
			const config: MomentumConfig = {
				collections: [mockCollection],
				db: { adapter },
				server: { port: 4000 },
			};

			const result = initializeMomentum(config, { logging: false });
			await result.ready;

			expect(initializeMomentumAPI).toHaveBeenCalledWith(config);
			expect(runSeeding).not.toHaveBeenCalled();
			expect(result.isReady()).toBe(true);
		});

		it('should initialize database schema if adapter supports it', async () => {
			const adapter = createMockAdapter(true);
			const config: MomentumConfig = {
				collections: [mockCollection],
				db: { adapter },
				server: { port: 4000 },
			};

			const result = initializeMomentum(config, { logging: false });
			await result.ready;

			expect(adapter.initialize).toHaveBeenCalledWith([mockCollection]);
		});

		it('should skip schema initialization if adapter does not support it', async () => {
			const adapter = createMockAdapter(false);
			const config: MomentumConfig = {
				collections: [mockCollection],
				db: { adapter },
				server: { port: 4000 },
			};

			const result = initializeMomentum(config, { logging: false });
			await result.ready;

			// Should not throw, just continue
			expect(initializeMomentumAPI).toHaveBeenCalled();
		});
	});

	describe('seeding', () => {
		it('should run seeding when configured with runOnStart: true', async () => {
			const adapter = createMockAdapter();
			const seedingConfig: SeedingConfig = {
				defaults: () => [],
				options: { runOnStart: true, onConflict: 'skip' },
			};
			const config: MomentumConfig = {
				collections: [mockCollection],
				db: { adapter },
				server: { port: 4000 },
				seeding: seedingConfig,
			};

			const result = initializeMomentum(config, { logging: false });
			await result.ready;

			expect(shouldRunSeeding).toHaveBeenCalledWith(true);
			expect(runSeeding).toHaveBeenCalledWith(seedingConfig, adapter, { auth: undefined });
		});

		it('should run seeding when configured with runOnStart: "always"', async () => {
			const adapter = createMockAdapter();
			const seedingConfig: SeedingConfig = {
				defaults: () => [],
				options: { runOnStart: 'always', onConflict: 'skip' },
			};
			const config: MomentumConfig = {
				collections: [mockCollection],
				db: { adapter },
				server: { port: 4000 },
				seeding: seedingConfig,
			};

			const result = initializeMomentum(config, { logging: false });
			await result.ready;

			expect(runSeeding).toHaveBeenCalled();
		});

		it('should not run seeding when runOnStart is false', async () => {
			const adapter = createMockAdapter();
			const seedingConfig: SeedingConfig = {
				defaults: () => [],
				options: { runOnStart: false, onConflict: 'skip' },
			};
			const config: MomentumConfig = {
				collections: [mockCollection],
				db: { adapter },
				server: { port: 4000 },
				seeding: seedingConfig,
			};

			const result = initializeMomentum(config, { logging: false });
			await result.ready;

			expect(runSeeding).not.toHaveBeenCalled();
		});

		it('should return seeding result after completion', async () => {
			const adapter = createMockAdapter();
			const seedingConfig: SeedingConfig = {
				defaults: () => [],
				options: { runOnStart: true, onConflict: 'skip' },
			};
			const config: MomentumConfig = {
				collections: [mockCollection],
				db: { adapter },
				server: { port: 4000 },
				seeding: seedingConfig,
			};

			const result = initializeMomentum(config, { logging: false });
			await result.ready;

			expect(result.seedingResult).toEqual({
				created: 2,
				updated: 1,
				skipped: 1,
				total: 4,
				seeds: [],
			});
		});

		it('should propagate seeding errors through ready promise', async () => {
			const seedingError = new Error('Seeding failed: database error');
			vi.mocked(runSeeding).mockRejectedValueOnce(seedingError);

			const adapter = createMockAdapter();
			const seedingConfig: SeedingConfig = {
				defaults: () => [],
				options: { runOnStart: true, onConflict: 'skip' },
			};
			const config: MomentumConfig = {
				collections: [mockCollection],
				db: { adapter },
				server: { port: 4000 },
				seeding: seedingConfig,
			};

			const result = initializeMomentum(config, { logging: false });

			await expect(result.ready).rejects.toThrow('Seeding failed: database error');
			expect(result.isReady()).toBe(false);
		});

		it('should propagate database initialization errors', async () => {
			const adapter = createMockAdapter();
			const initError = new Error('Database connection failed');
			vi.mocked(adapter.initialize as typeof adapter.initialize).mockRejectedValueOnce(initError);

			const config: MomentumConfig = {
				collections: [mockCollection],
				db: { adapter },
				server: { port: 4000 },
			};

			const result = initializeMomentum(config, { logging: false });

			await expect(result.ready).rejects.toThrow('Database connection failed');
			expect(result.isReady()).toBe(false);
		});
	});

	describe('getSeedingStatus', () => {
		it('should return zero counts before initialization', () => {
			const adapter = createMockAdapter();
			const config: MomentumConfig = {
				collections: [mockCollection],
				db: { adapter },
				server: { port: 4000 },
			};

			const result = initializeMomentum(config, { logging: false });
			const status = result.getSeedingStatus();

			expect(status.completed).toBe(0);
			expect(status.expected).toBe(0);
			expect(status.ready).toBe(false);
		});

		it('should return correct counts after seeding completes', async () => {
			const adapter = createMockAdapter();
			const seedingConfig: SeedingConfig = {
				defaults: () => [],
				options: { runOnStart: true, onConflict: 'skip' },
			};
			const config: MomentumConfig = {
				collections: [mockCollection],
				db: { adapter },
				server: { port: 4000 },
				seeding: seedingConfig,
			};

			const result = initializeMomentum(config, { logging: false });
			await result.ready;

			const status = result.getSeedingStatus();
			expect(status.completed).toBe(4);
			expect(status.expected).toBe(4);
			expect(status.ready).toBe(true);
		});
	});

	describe('logging', () => {
		it('should log messages when logging is enabled', async () => {
			const adapter = createMockAdapter();
			const config: MomentumConfig = {
				collections: [mockCollection],
				db: { adapter },
				server: { port: 4000 },
			};

			const logger = vi.fn();
			const result = initializeMomentum(config, { logging: true, logger });
			await result.ready;

			expect(logger).toHaveBeenCalled();
			expect(logger.mock.calls.some((call) => call[0].includes('Initializing'))).toBe(true);
		});

		it('should not log when logging is disabled', async () => {
			const adapter = createMockAdapter();
			const config: MomentumConfig = {
				collections: [mockCollection],
				db: { adapter },
				server: { port: 4000 },
			};

			const logger = vi.fn();
			const result = initializeMomentum(config, { logging: false, logger });
			await result.ready;

			expect(logger).not.toHaveBeenCalled();
		});
	});

	describe('isReady', () => {
		it('should return false before initialization completes', () => {
			const adapter = createMockAdapter();
			const config: MomentumConfig = {
				collections: [mockCollection],
				db: { adapter },
				server: { port: 4000 },
			};

			const result = initializeMomentum(config, { logging: false });
			// Don't await - check immediately
			expect(result.isReady()).toBe(false);
		});

		it('should return true after initialization completes', async () => {
			const adapter = createMockAdapter();
			const config: MomentumConfig = {
				collections: [mockCollection],
				db: { adapter },
				server: { port: 4000 },
			};

			const result = initializeMomentum(config, { logging: false });
			await result.ready;

			expect(result.isReady()).toBe(true);
		});
	});
});

describe('createHealthMiddleware', () => {
	let app: express.Application;

	beforeEach(() => {
		app = express();
	});

	describe('basic health check', () => {
		it('should return ok status when no options provided', async () => {
			app.use('/health', createHealthMiddleware());

			const res = await request(app).get('/health');

			expect(res.status).toBe(200);
			expect(res.body.status).toBe('ok');
			expect(res.body.ready).toBe(true);
		});

		it('should return ready status based on isReady function', async () => {
			app.use('/health', createHealthMiddleware({ isReady: () => false }));

			const res = await request(app).get('/health');

			expect(res.status).toBe(200);
			expect(res.body.status).toBe('initializing');
			expect(res.body.ready).toBe(false);
		});

		it('should return ok when isReady returns true', async () => {
			app.use('/health', createHealthMiddleware({ isReady: () => true }));

			const res = await request(app).get('/health');

			expect(res.body.status).toBe('ok');
			expect(res.body.ready).toBe(true);
		});
	});

	describe('seeding status', () => {
		it('should include seeds in response when getSeedingStatus provided', async () => {
			app.use(
				'/health',
				createHealthMiddleware({
					getSeedingStatus: () => ({
						completed: 4,
						expected: 4,
						ready: true,
					}),
				}),
			);

			const res = await request(app).get('/health');

			expect(res.body.seeds).toEqual({
				completed: 4,
				expected: 4,
				ready: true,
			});
		});

		it('should not include seeds when getSeedingStatus not provided', async () => {
			app.use('/health', createHealthMiddleware());

			const res = await request(app).get('/health');

			expect(res.body.seeds).toBeUndefined();
		});
	});

	describe('checkSeeds query parameter', () => {
		it('should wait for ready promise when checkSeeds=true', async () => {
			let resolved = false;
			const waitPromise = new Promise<void>((resolve) => {
				setTimeout(() => {
					resolved = true;
					resolve();
				}, 50);
			});

			app.use(
				'/health',
				createHealthMiddleware({
					waitForReady: waitPromise,
					isReady: () => resolved,
				}),
			);

			const res = await request(app).get('/health?checkSeeds=true');

			expect(res.body.ready).toBe(true);
			expect(resolved).toBe(true);
		});

		it('should not wait when checkSeeds is not provided', async () => {
			let resolved = false;
			const waitPromise = new Promise<void>((resolve) => {
				setTimeout(() => {
					resolved = true;
					resolve();
				}, 100);
			});

			app.use(
				'/health',
				createHealthMiddleware({
					waitForReady: waitPromise,
					isReady: () => resolved,
				}),
			);

			const res = await request(app).get('/health');

			// Should return immediately without waiting
			expect(res.body.ready).toBe(false);
		});

		it('should handle rejected waitForReady promise gracefully', async () => {
			const waitPromise = Promise.reject(new Error('Init failed'));
			// Add catch handler to prevent unhandled rejection warning
			// eslint-disable-next-line @typescript-eslint/no-empty-function -- Intentional empty handler to prevent unhandled rejection
			waitPromise.catch((): void => {});

			app.use(
				'/health',
				createHealthMiddleware({
					waitForReady: waitPromise,
					isReady: () => false,
				}),
			);

			const res = await request(app).get('/health?checkSeeds=true');

			// Should not throw, just return current status
			expect(res.status).toBe(200);
			expect(res.body.status).toBe('initializing');
		});
	});

	describe('additional data', () => {
		it('should include additional data in response', async () => {
			app.use(
				'/health',
				createHealthMiddleware({
					additionalData: () => ({
						version: '1.0.0',
						environment: 'test',
					}),
				}),
			);

			const res = await request(app).get('/health');

			expect(res.body.version).toBe('1.0.0');
			expect(res.body.environment).toBe('test');
		});

		it('should merge additional data with standard fields', async () => {
			app.use(
				'/health',
				createHealthMiddleware({
					isReady: () => true,
					getSeedingStatus: () => ({ completed: 2, expected: 2, ready: true }),
					additionalData: () => ({ custom: 'value' }),
				}),
			);

			const res = await request(app).get('/health');

			expect(res.body.status).toBe('ok');
			expect(res.body.ready).toBe(true);
			expect(res.body.seeds).toBeDefined();
			expect(res.body.custom).toBe('value');
		});
	});

	describe('integration with initializeMomentum', () => {
		it('should work correctly with initializeMomentum result', async () => {
			const adapter = createMockAdapter();
			const seedingConfig: SeedingConfig = {
				defaults: () => [],
				options: { runOnStart: true, onConflict: 'skip' },
			};
			const config: MomentumConfig = {
				collections: [mockCollection],
				db: { adapter },
				server: { port: 4000 },
				seeding: seedingConfig,
			};

			const momentum = initializeMomentum(config, { logging: false });

			app.use(
				'/health',
				createHealthMiddleware({
					isReady: momentum.isReady,
					getSeedingStatus: momentum.getSeedingStatus,
					waitForReady: momentum.ready,
				}),
			);

			// Before ready
			const _res1 = await request(app).get('/health');
			// Status depends on timing, but should not error

			// After ready (with checkSeeds)
			const res2 = await request(app).get('/health?checkSeeds=true');
			expect(res2.body.ready).toBe(true);
			expect(res2.body.seeds.completed).toBe(4);
		});
	});
});
