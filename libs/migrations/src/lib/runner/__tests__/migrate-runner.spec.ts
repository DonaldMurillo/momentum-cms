import { describe, it, expect, vi } from 'vitest';
import {
	runMigrations,
	rollbackBatch,
	getMigrationStatus,
} from '../migrate-runner';
import type { LoadedMigration, MigrateRunnerOptions } from '../migrate-runner';
import type { MigrationFile, MigrationContext } from '../../migration.types';
import type { TrackerQueryFn } from '../../tracking/migration-tracker';

// ============================================
// In-memory tracker (same pattern as tracker tests)
// ============================================

function createInMemoryTracker(): TrackerQueryFn & { rows: Record<string, unknown>[] } {
	const rows: Record<string, unknown>[] = [];

	return {
		rows,
		async query<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
			if (sql.includes('MAX("batch")')) {
				const maxBatch = rows.reduce(
					(max, r) => Math.max(max, Number(r['batch'] ?? 0)),
					0,
				);
				return [{ max_batch: rows.length > 0 ? maxBatch : null } as unknown as T];
			}

			if (sql.includes('COUNT(*)') && sql.includes('WHERE "name"')) {
				const name = params?.[0];
				const cnt = rows.filter((r) => r['name'] === name).length;
				return [{ cnt } as unknown as T];
			}

			if (sql.includes('WHERE "batch"')) {
				const batch = params?.[0];
				const matching = rows
					.filter((r) => r['batch'] === batch)
					.sort((a, b) => String(b['name']).localeCompare(String(a['name'])));
				return matching as T[];
			}

			const sorted = [...rows].sort((a, b) => {
				const batchDiff = Number(a['batch']) - Number(b['batch']);
				if (batchDiff !== 0) return batchDiff;
				return String(a['name']).localeCompare(String(b['name']));
			});
			return sorted as T[];
		},

		async execute(sql: string, params?: unknown[]): Promise<number> {
			if (sql.includes('CREATE TABLE')) return 0;

			if (sql.includes('INSERT INTO')) {
				const row: Record<string, unknown> = {};
				if (params) {
					const fields = ['id', 'name', 'batch', 'checksum', 'appliedAt', 'executionMs'];
					fields.forEach((f, i) => { row[f] = params[i]; });
				}
				rows.push(row);
				return 1;
			}

			if (sql.includes('DELETE FROM') && sql.includes('WHERE "name"')) {
				const name = params?.[0];
				const idx = rows.findIndex((r) => r['name'] === name);
				if (idx >= 0) { rows.splice(idx, 1); return 1; }
				return 0;
			}

			return 0;
		},
	};
}

// ============================================
// Mock migration files
// ============================================

function makeMigration(name: string, opts: { upFail?: boolean; downFail?: boolean } = {}): LoadedMigration {
	const upCalls: string[] = [];
	const downCalls: string[] = [];

	const file: MigrationFile = {
		meta: {
			name,
			description: `Migration ${name}`,
		},
		async up(_ctx: MigrationContext): Promise<void> {
			upCalls.push(name);
			if (opts.upFail) throw new Error(`up() failed for ${name}`);
		},
		async down(_ctx: MigrationContext): Promise<void> {
			downCalls.push(name);
			if (opts.downFail) throw new Error(`down() failed for ${name}`);
		},
	};

	return { name, file };
}

function buildMockContext(): MigrationContext {
	return {
		sql: vi.fn(),
		query: vi.fn().mockResolvedValue([]),
		data: {} as MigrationContext['data'],
		dialect: 'postgresql',
		log: { info: vi.fn(), warn: vi.fn() },
	};
}

function makeRunnerOptions(
	overrides: Partial<MigrateRunnerOptions> = {},
): MigrateRunnerOptions {
	return {
		migrations: [],
		dialect: 'postgresql',
		tracker: createInMemoryTracker(),
		buildContext: buildMockContext,
		skipDangerDetection: true,
		log: { info: vi.fn(), warn: vi.fn() },
		...overrides,
	};
}

// ============================================
// Tests
// ============================================

describe('migrate-runner', () => {
	describe('runMigrations', () => {
		it('should report no pending when all migrations are applied', async () => {
			const tracker = createInMemoryTracker();
			tracker.rows.push({
				id: '1',
				name: 'mig_001',
				batch: 1,
				checksum: 'abc',
				appliedAt: '2026-02-20T00:00:00Z',
				executionMs: 10,
			});

			const result = await runMigrations(
				makeRunnerOptions({
					migrations: [makeMigration('mig_001')],
					tracker,
				}),
			);

			expect(result.successCount).toBe(0);
			expect(result.failCount).toBe(0);
			expect(result.results).toHaveLength(0);
		});

		it('should run pending migrations in order', async () => {
			const tracker = createInMemoryTracker();
			const upOrder: string[] = [];

			const mig1: LoadedMigration = {
				name: 'mig_001',
				file: {
					meta: { name: 'mig_001', description: 'first' },
					async up(): Promise<void> { upOrder.push('mig_001'); },
					async down(): Promise<void> { /* noop */ },
				},
			};
			const mig2: LoadedMigration = {
				name: 'mig_002',
				file: {
					meta: { name: 'mig_002', description: 'second' },
					async up(): Promise<void> { upOrder.push('mig_002'); },
					async down(): Promise<void> { /* noop */ },
				},
			};

			const result = await runMigrations(
				makeRunnerOptions({
					migrations: [mig1, mig2],
					tracker,
				}),
			);

			expect(result.successCount).toBe(2);
			expect(result.failCount).toBe(0);
			expect(upOrder).toEqual(['mig_001', 'mig_002']);
			expect(result.batch).toBe(1);
		});

		it('should stop on first failure', async () => {
			const tracker = createInMemoryTracker();

			const result = await runMigrations(
				makeRunnerOptions({
					migrations: [
						makeMigration('mig_001'),
						makeMigration('mig_002', { upFail: true }),
						makeMigration('mig_003'),
					],
					tracker,
				}),
			);

			expect(result.successCount).toBe(1);
			expect(result.failCount).toBe(1);
			expect(result.results).toHaveLength(2);
			// mig_003 should not have been attempted
			expect(result.results.map((r) => r.name)).toEqual(['mig_001', 'mig_002']);
		});

		it('should record applied migrations in tracker', async () => {
			const tracker = createInMemoryTracker();

			await runMigrations(
				makeRunnerOptions({
					migrations: [makeMigration('mig_001'), makeMigration('mig_002')],
					tracker,
				}),
			);

			expect(tracker.rows).toHaveLength(2);
			expect(tracker.rows[0]['name']).toBe('mig_001');
			expect(tracker.rows[1]['name']).toBe('mig_002');
		});

		it('should only run new migrations when some are already applied', async () => {
			const tracker = createInMemoryTracker();
			tracker.rows.push({
				id: '1',
				name: 'mig_001',
				batch: 1,
				checksum: 'abc',
				appliedAt: '2026-02-20T00:00:00Z',
				executionMs: 10,
			});

			const result = await runMigrations(
				makeRunnerOptions({
					migrations: [makeMigration('mig_001'), makeMigration('mig_002')],
					tracker,
				}),
			);

			expect(result.successCount).toBe(1);
			expect(result.results.map((r) => r.name)).toEqual(['mig_002']);
		});

		it('should assign incrementing batch numbers', async () => {
			const tracker = createInMemoryTracker();

			await runMigrations(
				makeRunnerOptions({
					migrations: [makeMigration('mig_001')],
					tracker,
				}),
			);

			const result2 = await runMigrations(
				makeRunnerOptions({
					migrations: [makeMigration('mig_001'), makeMigration('mig_002')],
					tracker,
				}),
			);

			expect(result2.batch).toBe(2);
		});
	});

	describe('rollbackBatch', () => {
		it('should do nothing when no migrations exist', async () => {
			const tracker = createInMemoryTracker();

			const result = await rollbackBatch(
				makeRunnerOptions({ tracker }),
			);

			expect(result.successCount).toBe(0);
		});

		it('should rollback all migrations in the latest batch', async () => {
			const tracker = createInMemoryTracker();
			const downOrder: string[] = [];

			const mig1: LoadedMigration = {
				name: 'mig_001',
				file: {
					meta: { name: 'mig_001', description: '' },
					async up(): Promise<void> { /* noop */ },
					async down(): Promise<void> { downOrder.push('mig_001'); },
				},
			};
			const mig2: LoadedMigration = {
				name: 'mig_002',
				file: {
					meta: { name: 'mig_002', description: '' },
					async up(): Promise<void> { /* noop */ },
					async down(): Promise<void> { downOrder.push('mig_002'); },
				},
			};

			// Apply both
			await runMigrations(
				makeRunnerOptions({ migrations: [mig1, mig2], tracker }),
			);
			expect(tracker.rows).toHaveLength(2);

			// Rollback
			const result = await rollbackBatch(
				makeRunnerOptions({ migrations: [mig1, mig2], tracker }),
			);

			expect(result.successCount).toBe(2);
			expect(result.failCount).toBe(0);
			// Should run down() in reverse order
			expect(downOrder).toEqual(['mig_002', 'mig_001']);
			// Tracker should be empty
			expect(tracker.rows).toHaveLength(0);
		});

		it('should stop on rollback failure', async () => {
			const tracker = createInMemoryTracker();
			const failMig = makeMigration('mig_002', { downFail: true });

			await runMigrations(
				makeRunnerOptions({
					migrations: [makeMigration('mig_001'), failMig],
					tracker,
				}),
			);

			const result = await rollbackBatch(
				makeRunnerOptions({
					migrations: [makeMigration('mig_001'), failMig],
					tracker,
				}),
			);

			expect(result.failCount).toBe(1);
			// mig_002 fails, so mig_001 is not rolled back
			expect(result.results).toHaveLength(1);
		});

		it('should handle missing migration file', async () => {
			const tracker = createInMemoryTracker();

			// Manually insert a record with no matching migration file
			tracker.rows.push({
				id: '1',
				name: 'missing_migration',
				batch: 1,
				checksum: 'abc',
				appliedAt: '2026-02-20T00:00:00Z',
				executionMs: 10,
			});

			const result = await rollbackBatch(
				makeRunnerOptions({
					migrations: [], // No migration files available
					tracker,
				}),
			);

			expect(result.failCount).toBe(1);
			expect(result.results[0].error).toContain('not found');
		});
	});

	describe('getMigrationStatus', () => {
		it('should show all as pending when none are applied', async () => {
			const tracker = createInMemoryTracker();
			const migrations = [makeMigration('mig_001'), makeMigration('mig_002')];

			const status = await getMigrationStatus(migrations, tracker, 'postgresql');

			expect(status).toHaveLength(2);
			expect(status[0]).toEqual({ name: 'mig_001', status: 'pending' });
			expect(status[1]).toEqual({ name: 'mig_002', status: 'pending' });
		});

		it('should show applied migrations with batch info', async () => {
			const tracker = createInMemoryTracker();
			tracker.rows.push({
				id: '1',
				name: 'mig_001',
				batch: 1,
				checksum: 'abc',
				appliedAt: '2026-02-20T14:30:00Z',
				executionMs: 10,
			});

			const migrations = [makeMigration('mig_001'), makeMigration('mig_002')];
			const status = await getMigrationStatus(migrations, tracker, 'postgresql');

			expect(status[0]).toEqual({
				name: 'mig_001',
				status: 'applied',
				batch: 1,
				appliedAt: '2026-02-20T14:30:00Z',
			});
			expect(status[1]).toEqual({ name: 'mig_002', status: 'pending' });
		});
	});
});
