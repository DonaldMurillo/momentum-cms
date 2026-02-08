import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { runSeeding, shouldRunSeeding, calculateChecksum } from '../seed-executor';
import type { DatabaseAdapter, SeedingConfig } from '@momentum-cms/core';

// Mock the logger module so seed-executor's createLogger returns a spy
const mockLoggerInfo = vi.fn();
const mockLoggerWarn = vi.fn();
vi.mock('@momentum-cms/logger', () => ({
	createLogger: () => ({
		debug: vi.fn(),
		info: mockLoggerInfo,
		warn: mockLoggerWarn,
		error: vi.fn(),
		fatal: vi.fn(),
		child: vi.fn(() => ({
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			fatal: vi.fn(),
		})),
	}),
	initializeMomentumLogger: vi.fn(),
}));

describe('calculateChecksum', () => {
	it('should generate consistent checksums for same data', () => {
		const data = { name: 'Test', email: 'test@example.com' };
		const checksum1 = calculateChecksum(data);
		const checksum2 = calculateChecksum(data);

		expect(checksum1).toBe(checksum2);
	});

	it('should generate different checksums for different data', () => {
		const data1 = { name: 'Test1' };
		const data2 = { name: 'Test2' };

		expect(calculateChecksum(data1)).not.toBe(calculateChecksum(data2));
	});

	it('should normalize key order', () => {
		const data1 = { a: 1, b: 2 };
		const data2 = { b: 2, a: 1 };

		expect(calculateChecksum(data1)).toBe(calculateChecksum(data2));
	});

	it('should return SHA-256 hex string', () => {
		const checksum = calculateChecksum({ test: 'data' });

		// SHA-256 produces 64 character hex string
		expect(checksum).toMatch(/^[a-f0-9]{64}$/);
	});
});

describe('shouldRunSeeding', () => {
	const originalEnv = process.env['NODE_ENV'];

	afterEach(() => {
		if (originalEnv === undefined) {
			delete process.env['NODE_ENV'];
		} else {
			process.env['NODE_ENV'] = originalEnv;
		}
	});

	it('should return false when runOnStart is false', () => {
		expect(shouldRunSeeding(false)).toBe(false);
	});

	it('should return true when runOnStart is true', () => {
		expect(shouldRunSeeding(true)).toBe(true);
	});

	it('should return true when runOnStart is "always"', () => {
		expect(shouldRunSeeding('always')).toBe(true);
	});

	it('should return true when runOnStart is "development" and NODE_ENV is development', () => {
		process.env['NODE_ENV'] = 'development';
		expect(shouldRunSeeding('development')).toBe(true);
	});

	it('should return true when runOnStart is "development" and NODE_ENV is not set', () => {
		delete process.env['NODE_ENV'];
		expect(shouldRunSeeding('development')).toBe(true);
	});

	it('should return false when runOnStart is "development" and NODE_ENV is production', () => {
		process.env['NODE_ENV'] = 'production';
		expect(shouldRunSeeding('development')).toBe(false);
	});
});

describe('runSeeding', () => {
	let mockAdapter: DatabaseAdapter;

	beforeEach(() => {
		// Track created seed records for lookups
		const seedRecords: Record<string, unknown>[] = [];

		mockAdapter = {
			find: vi.fn(async (_coll, query) => {
				if (query['seedId']) {
					return seedRecords.filter((r) => r['seedId'] === query['seedId']);
				}
				return seedRecords;
			}),
			findById: vi.fn(async () => null),
			create: vi.fn(async (_coll, data) => {
				const doc = { id: `doc-${Date.now()}`, ...data };
				if (_coll === '_momentum_seeds') {
					seedRecords.push(doc);
				}
				return doc;
			}),
			update: vi.fn(async (_coll, _id, data) => ({
				id: _id,
				...data,
				updatedAt: new Date().toISOString(),
			})),
			delete: vi.fn(async () => true),
		};

		mockLoggerInfo.mockClear();
		mockLoggerWarn.mockClear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should process defaults array in order', async () => {
		const config: SeedingConfig = {
			defaults: ({ user, collection }) => [
				user('admin', { name: 'Admin', email: 'admin@example.com' }),
				collection<{ title: string }>('posts').create('first', { title: 'First' }),
			],
			options: { quiet: true },
		};

		const result = await runSeeding(config, mockAdapter);

		expect(result.total).toBe(2);
		expect(result.created).toBe(2);
		expect(result.seeds[0].seedId).toBe('admin');
		expect(result.seeds[1].seedId).toBe('first');
	});

	it('should skip existing seeds when onConflict is skip', async () => {
		// Pre-populate seed record
		vi.mocked(mockAdapter.find).mockImplementation(async (_coll, query) => {
			if (query['seedId'] === 'existing') {
				return [
					{
						id: 'track-1',
						seedId: 'existing',
						collection: 'posts',
						documentId: 'post-1',
						checksum: calculateChecksum({ title: 'Existing' }),
					},
				];
			}
			return [];
		});
		vi.mocked(mockAdapter.findById).mockResolvedValue({ id: 'post-1', title: 'Existing' });

		const config: SeedingConfig = {
			defaults: ({ collection }) => [
				collection<{ title: string }>('posts').create('existing', { title: 'Existing' }),
			],
			options: { onConflict: 'skip', quiet: true },
		};

		const result = await runSeeding(config, mockAdapter);

		expect(result.skipped).toBe(1);
		expect(result.created).toBe(0);
		expect(mockAdapter.create).not.toHaveBeenCalledWith('posts', expect.anything());
	});

	it('should update seeds when onConflict is update and data changed', async () => {
		const oldChecksum = calculateChecksum({ title: 'Old Title' });

		vi.mocked(mockAdapter.find).mockImplementation(async (_coll, query) => {
			if (query['seedId'] === 'updatable') {
				return [
					{
						id: 'track-1',
						seedId: 'updatable',
						collection: 'posts',
						documentId: 'post-1',
						checksum: oldChecksum,
					},
				];
			}
			return [];
		});

		const config: SeedingConfig = {
			defaults: ({ collection }) => [
				collection<{ title: string }>('posts').create('updatable', { title: 'New Title' }),
			],
			options: { onConflict: 'update', quiet: true },
		};

		const result = await runSeeding(config, mockAdapter);

		expect(result.updated).toBe(1);
		expect(mockAdapter.update).toHaveBeenCalledWith('posts', 'post-1', { title: 'New Title' });
	});

	it('should skip update when data unchanged', async () => {
		const currentData = { title: 'Same Title' };
		const currentChecksum = calculateChecksum(currentData);

		vi.mocked(mockAdapter.find).mockImplementation(async (_coll, query) => {
			if (query['seedId'] === 'unchanged') {
				return [
					{
						id: 'track-1',
						seedId: 'unchanged',
						collection: 'posts',
						documentId: 'post-1',
						checksum: currentChecksum,
					},
				];
			}
			return [];
		});
		vi.mocked(mockAdapter.findById).mockResolvedValue({ id: 'post-1', ...currentData });

		const config: SeedingConfig = {
			defaults: ({ collection }) => [
				collection<{ title: string }>('posts').create('unchanged', { title: 'Same Title' }),
			],
			options: { onConflict: 'update', quiet: true },
		};

		const result = await runSeeding(config, mockAdapter);

		expect(result.skipped).toBe(1);
		expect(result.updated).toBe(0);
		// Should not update the actual collection
		expect(mockAdapter.update).not.toHaveBeenCalledWith(
			'posts',
			expect.anything(),
			expect.anything(),
		);
	});

	it('should throw SeedConflictError when onConflict is error and seed exists', async () => {
		vi.mocked(mockAdapter.find).mockImplementation(async (_coll, query) => {
			if (query['seedId'] === 'conflict-seed') {
				return [
					{
						id: 'track-1',
						seedId: 'conflict-seed',
						collection: 'posts',
						documentId: 'post-1',
						checksum: 'some-hash',
					},
				];
			}
			return [];
		});

		const config: SeedingConfig = {
			defaults: ({ collection }) => [
				collection<{ title: string }>('posts').create('conflict-seed', { title: 'Conflict' }),
			],
			options: { onConflict: 'error', quiet: true },
		};

		await expect(runSeeding(config, mockAdapter)).rejects.toThrow('Seed conflict');
	});

	it('should run custom seed function after defaults', async () => {
		const seedOrder: string[] = [];

		vi.mocked(mockAdapter.create).mockImplementation(async (_coll, data) => {
			seedOrder.push((data['seedId'] as string) || (data['title'] as string));
			return { id: `doc-${Date.now()}`, ...data };
		});

		const config: SeedingConfig = {
			defaults: ({ user }) => [user('admin', { name: 'Admin', email: 'admin@example.com' })],
			seed: async (ctx) => {
				await ctx.seed({
					seedId: 'custom-post',
					collection: 'posts',
					data: { title: 'Custom' },
				});
			},
			options: { quiet: true },
		};

		await runSeeding(config, mockAdapter);

		// admin should come before custom-post
		const adminIndex = seedOrder.indexOf('admin');
		const customIndex = seedOrder.indexOf('custom-post');
		expect(adminIndex).toBeLessThan(customIndex);
	});

	it('should provide working getSeeded in context', async () => {
		let resolvedId: string | undefined;

		const config: SeedingConfig = {
			defaults: ({ user }) => [
				user('admin', { name: 'Admin', email: 'admin@example.com', role: 'admin' }),
			],
			seed: async (ctx) => {
				const admin = await ctx.getSeeded('admin');
				resolvedId = admin?.id;
			},
			options: { quiet: true },
		};

		await runSeeding(config, mockAdapter);

		expect(resolvedId).toBeDefined();
		expect(resolvedId).toMatch(/^doc-/);
	});

	it('should return null from getSeeded for non-existent seed', async () => {
		let result: unknown = 'not-set';

		const config: SeedingConfig = {
			seed: async (ctx) => {
				result = await ctx.getSeeded('non-existent');
			},
			options: { quiet: true },
		};

		await runSeeding(config, mockAdapter);

		expect(result).toBeNull();
	});

	it('should track seeds created in custom function', async () => {
		const config: SeedingConfig = {
			seed: async (ctx) => {
				await ctx.seed({
					seedId: 'custom-1',
					collection: 'posts',
					data: { title: 'Custom 1' },
				});
				await ctx.seed({
					seedId: 'custom-2',
					collection: 'posts',
					data: { title: 'Custom 2' },
				});
			},
			options: { quiet: true },
		};

		const result = await runSeeding(config, mockAdapter);

		expect(result.total).toBe(2);
		expect(result.created).toBe(2);
	});

	it('should log messages when not in quiet mode', async () => {
		mockLoggerInfo.mockClear();

		const config: SeedingConfig = {
			defaults: ({ user }) => [user('admin', { name: 'Admin', email: 'admin@example.com' })],
			options: { quiet: false },
		};

		await runSeeding(config, mockAdapter);

		expect(mockLoggerInfo).toHaveBeenCalled();
		expect(mockLoggerInfo.mock.calls.some((call: string[]) => call[0].includes('Seeding'))).toBe(
			true,
		);
	});

	it('should suppress logs in quiet mode', async () => {
		mockLoggerInfo.mockClear();

		const config: SeedingConfig = {
			defaults: ({ user }) => [user('admin', { name: 'Admin', email: 'admin@example.com' })],
			options: { quiet: true },
		};

		await runSeeding(config, mockAdapter);

		expect(mockLoggerInfo).not.toHaveBeenCalled();
	});

	describe('rollback on failure', () => {
		it('should rollback created seeds when custom seed function fails', async () => {
			const deletedSeeds: string[] = [];

			// Track created seeds
			const createdSeeds: Array<{ id: string; seedId?: string }> = [];
			vi.mocked(mockAdapter.create).mockImplementation(async (_coll, data) => {
				const doc = { id: `doc-${Date.now()}-${Math.random()}`, ...data };
				createdSeeds.push({ id: doc.id, seedId: data['seedId'] as string | undefined });
				return doc;
			});

			// Track deletions
			vi.mocked(mockAdapter.delete).mockImplementation(async (_coll, id) => {
				deletedSeeds.push(id);
				return true;
			});

			const config: SeedingConfig = {
				defaults: ({ user }) => [user('admin', { name: 'Admin', email: 'admin@example.com' })],
				seed: async () => {
					throw new Error('Custom seed function failed');
				},
				options: { quiet: true },
			};

			await expect(runSeeding(config, mockAdapter)).rejects.toThrow('Seeding failed');

			// Verify rollback occurred
			expect(deletedSeeds.length).toBeGreaterThan(0);
		});

		it('should include rolled back seeds in SeedRollbackError', async () => {
			vi.mocked(mockAdapter.create).mockImplementation(async (_coll, data) => {
				return { id: `doc-${Date.now()}`, ...data };
			});
			vi.mocked(mockAdapter.delete).mockResolvedValue(true);

			const config: SeedingConfig = {
				defaults: ({ user }) => [user('admin', { name: 'Admin', email: 'admin@example.com' })],
				seed: async () => {
					throw new Error('Intentional failure');
				},
				options: { quiet: true },
			};

			try {
				await runSeeding(config, mockAdapter);
				expect.fail('Should have thrown');
			} catch (error) {
				expect(error).toHaveProperty('rolledBackSeeds');
				expect(error).toHaveProperty('originalError');
				const rollbackError = error as { rolledBackSeeds: unknown[]; originalError: Error };
				expect(rollbackError.rolledBackSeeds.length).toBeGreaterThan(0);
				expect(rollbackError.originalError.message).toBe('Intentional failure');
			}
		});

		it('should track rollback failures', async () => {
			vi.mocked(mockAdapter.create).mockImplementation(async (_coll, data) => {
				return { id: `doc-${Date.now()}`, ...data };
			});
			// Make delete fail
			vi.mocked(mockAdapter.delete).mockRejectedValue(new Error('Delete failed'));

			const config: SeedingConfig = {
				defaults: ({ user }) => [user('admin', { name: 'Admin', email: 'admin@example.com' })],
				seed: async () => {
					throw new Error('Seed failed');
				},
				options: { quiet: true },
			};

			try {
				await runSeeding(config, mockAdapter);
				expect.fail('Should have thrown');
			} catch (error) {
				expect(error).toHaveProperty('rollbackFailures');
				const rollbackError = error as { rollbackFailures: unknown[] };
				expect(rollbackError.rollbackFailures.length).toBeGreaterThan(0);
			}
		});

		it('should not rollback if no seeds were created', async () => {
			// All seeds will be skipped (already exist)
			vi.mocked(mockAdapter.find).mockResolvedValue([
				{
					id: 'track-1',
					seedId: 'admin',
					collection: 'user',
					documentId: 'user-1',
					checksum: 'hash',
				},
			]);
			vi.mocked(mockAdapter.findById).mockResolvedValue({ id: 'user-1', name: 'Admin' });

			const config: SeedingConfig = {
				defaults: ({ user }) => [user('admin', { name: 'Admin', email: 'admin@example.com' })],
				seed: async () => {
					throw new Error('Seed failed');
				},
				options: { quiet: true, onConflict: 'skip' },
			};

			// Should throw the original error, not a SeedRollbackError
			await expect(runSeeding(config, mockAdapter)).rejects.toThrow('Seed failed');
			await expect(runSeeding(config, mockAdapter)).rejects.not.toHaveProperty('rolledBackSeeds');
		});
	});
});
