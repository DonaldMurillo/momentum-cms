import { describe, it, expect, vi } from 'vitest';
import { cloneTestApply } from '../clone-test-apply';
import type { CloneTestApplyOptions, CloneCapableDb } from '../clone-test-apply';
import type { LoadedMigration } from '../migrate-runner';
import type { MigrationFile, MigrationContext } from '../../migration.types';
import type { TrackerQueryFn } from '../../tracking/migration-tracker';

// ============================================
// In-memory tracker (same as migrate-runner tests)
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
// Mock helpers
// ============================================

function createMockDb(): CloneCapableDb & { clonedDbs: string[]; droppedDbs: string[] } {
	const clonedDbs: string[] = [];
	const droppedDbs: string[] = [];

	return {
		clonedDbs,
		droppedDbs,
		async cloneDatabase(targetName: string): Promise<string> {
			clonedDbs.push(targetName);
			return targetName;
		},
		async dropClone(targetName: string): Promise<void> {
			droppedDbs.push(targetName);
		},
	};
}

function makeMigration(name: string, opts: { upFail?: boolean; upError?: string; upErrorCode?: string } = {}): LoadedMigration {
	const file: MigrationFile = {
		meta: {
			name,
			description: `Migration ${name}`,
		},
		async up(_ctx: MigrationContext): Promise<void> {
			if (opts.upFail) {
				const err = new Error(opts.upError ?? `up() failed for ${name}`);
				if (opts.upErrorCode) {
					Object.assign(err, { code: opts.upErrorCode });
				}
				throw err;
			}
		},
		async down(_ctx: MigrationContext): Promise<void> { /* noop */ },
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

function makeOptions(overrides: Partial<CloneTestApplyOptions> = {}): CloneTestApplyOptions {
	return {
		migrations: [],
		dialect: 'postgresql',
		tracker: createInMemoryTracker(),
		buildContext: buildMockContext,
		db: createMockDb(),
		buildCloneTracker: () => createInMemoryTracker(),
		buildCloneContext: () => buildMockContext(),
		skipDangerDetection: true,
		log: { info: vi.fn(), warn: vi.fn() },
		...overrides,
	};
}

// ============================================
// Tests
// ============================================

describe('clone-test-apply', () => {
	describe('happy path', () => {
		it('should complete full pipeline when migrations succeed', async () => {
			const db = createMockDb();
			const tracker = createInMemoryTracker();

			const result = await cloneTestApply(
				makeOptions({
					migrations: [makeMigration('mig_001'), makeMigration('mig_002')],
					db,
					tracker,
				}),
			);

			expect(result.phase).toBe('complete');
			expect(result.cloneResult).not.toBeNull();
			expect(result.cloneResult?.successCount).toBe(2);
			expect(result.applyResult).not.toBeNull();
			expect(result.applyResult?.successCount).toBe(2);
			expect(result.cloneCleanedUp).toBe(true);
			expect(result.error).toBeUndefined();
			expect(result.suggestions).toHaveLength(0);
		});

		it('should clone and drop the database', async () => {
			const db = createMockDb();

			const result = await cloneTestApply(
				makeOptions({
					migrations: [makeMigration('mig_001')],
					db,
				}),
			);

			expect(db.clonedDbs).toHaveLength(1);
			expect(db.clonedDbs[0]).toMatch(/^_mig_clone_\d+$/);
			expect(db.droppedDbs).toHaveLength(1);
			expect(db.droppedDbs[0]).toBe(db.clonedDbs[0]);
			expect(result.cloneName).toBe(db.clonedDbs[0]);
		});

		it('should record migrations in real tracker after apply', async () => {
			const tracker = createInMemoryTracker();

			await cloneTestApply(
				makeOptions({
					migrations: [makeMigration('mig_001'), makeMigration('mig_002')],
					tracker,
				}),
			);

			expect(tracker.rows).toHaveLength(2);
			expect(tracker.rows[0]['name']).toBe('mig_001');
			expect(tracker.rows[1]['name']).toBe('mig_002');
		});
	});

	describe('clone test failure', () => {
		it('should stop and not apply to real DB when clone test fails', async () => {
			const tracker = createInMemoryTracker();
			const db = createMockDb();

			const result = await cloneTestApply(
				makeOptions({
					migrations: [
						makeMigration('mig_001'),
						makeMigration('mig_002', { upFail: true }),
					],
					db,
					tracker,
				}),
			);

			expect(result.phase).toBe('test');
			expect(result.cloneResult).not.toBeNull();
			expect(result.cloneResult?.failCount).toBe(1);
			expect(result.applyResult).toBeNull();
			expect(result.error).toContain('Migration failed on clone');
			expect(result.cloneCleanedUp).toBe(true);
			// Real tracker should be empty — nothing applied
			expect(tracker.rows).toHaveLength(0);
		});

		it('should capture error code from database errors', async () => {
			const result = await cloneTestApply(
				makeOptions({
					migrations: [
						makeMigration('mig_001', {
							upFail: true,
							upError: 'unique violation',
							upErrorCode: '23505',
						}),
					],
				}),
			);

			const failed = result.cloneResult?.results.find((r) => !r.success);
			expect(failed).toBeDefined();
			expect(failed?.errorCode).toBe('23505');
		});

		it('should generate suggestions for NOT NULL violation', async () => {
			const result = await cloneTestApply(
				makeOptions({
					migrations: [
						makeMigration('mig_001', {
							upFail: true,
							upError: 'column "status" of relation "posts" contains null values (NOT NULL)',
						}),
					],
				}),
			);

			expect(result.suggestions.length).toBeGreaterThan(0);
			expect(result.suggestions[0]).toContain('backfill');
		});

		it('should generate suggestions for "already exists" error', async () => {
			const result = await cloneTestApply(
				makeOptions({
					migrations: [
						makeMigration('mig_001', {
							upFail: true,
							upError: 'column "title" already exists',
						}),
					],
				}),
			);

			expect(result.suggestions.length).toBeGreaterThan(0);
			expect(result.suggestions[0]).toContain('already exists');
		});

		it('should generate suggestions for FK violation', async () => {
			const result = await cloneTestApply(
				makeOptions({
					migrations: [
						makeMigration('mig_001', {
							upFail: true,
							upError: 'violates foreign key constraint "fk_author"',
						}),
					],
				}),
			);

			expect(result.suggestions.length).toBeGreaterThan(0);
			expect(result.suggestions[0]).toContain('Foreign key');
		});

		it('should generate suggestions for unique constraint violation', async () => {
			const result = await cloneTestApply(
				makeOptions({
					migrations: [
						makeMigration('mig_001', {
							upFail: true,
							upError: 'duplicate key value violates unique constraint "users_email_idx"',
						}),
					],
				}),
			);

			expect(result.suggestions.length).toBeGreaterThan(0);
			expect(result.suggestions[0]).toContain('dedup');
		});

		it('should generate suggestions for "does not exist" error', async () => {
			const result = await cloneTestApply(
				makeOptions({
					migrations: [
						makeMigration('mig_001', {
							upFail: true,
							upError: 'relation "categories" does not exist',
						}),
					],
				}),
			);

			expect(result.suggestions.length).toBeGreaterThan(0);
			expect(result.suggestions[0]).toContain('does not exist');
		});

		it('should generate suggestions for type cast error', async () => {
			const result = await cloneTestApply(
				makeOptions({
					migrations: [
						makeMigration('mig_001', {
							upFail: true,
							upError: 'column "age" cannot be cast automatically to type integer',
						}),
					],
				}),
			);

			expect(result.suggestions.length).toBeGreaterThan(0);
			expect(result.suggestions[0]).toContain('type');
		});

		it('should use SQLSTATE 23502 for NOT NULL violation', async () => {
			const result = await cloneTestApply(
				makeOptions({
					migrations: [
						makeMigration('mig_001', {
							upFail: true,
							upError: 'some pg error message',
							upErrorCode: '23502',
						}),
					],
				}),
			);

			expect(result.suggestions.length).toBeGreaterThan(0);
			expect(result.suggestions[0]).toContain('NOT NULL');
			expect(result.suggestions[0]).toContain('backfill');
		});

		it('should use SQLSTATE 23505 for unique violation', async () => {
			const result = await cloneTestApply(
				makeOptions({
					migrations: [
						makeMigration('mig_001', {
							upFail: true,
							upError: 'could not create unique index',
							upErrorCode: '23505',
						}),
					],
				}),
			);

			expect(result.suggestions.length).toBeGreaterThan(0);
			expect(result.suggestions[0]).toContain('dedup');
		});

		it('should use SQLSTATE 23503 for FK violation', async () => {
			const result = await cloneTestApply(
				makeOptions({
					migrations: [
						makeMigration('mig_001', {
							upFail: true,
							upError: 'insert or update on table violates foreign key constraint',
							upErrorCode: '23503',
						}),
					],
				}),
			);

			expect(result.suggestions.length).toBeGreaterThan(0);
			expect(result.suggestions[0]).toContain('Foreign key');
		});

		it('should use SQLSTATE 22P02 for type conversion error', async () => {
			const result = await cloneTestApply(
				makeOptions({
					migrations: [
						makeMigration('mig_001', {
							upFail: true,
							upError: 'invalid input syntax for type integer',
							upErrorCode: '22P02',
						}),
					],
				}),
			);

			expect(result.suggestions.length).toBeGreaterThan(0);
			expect(result.suggestions[0]).toContain('transform');
		});

		it('should prefer SQLSTATE code over string matching', async () => {
			// Error message says "does not exist" but code says unique_violation
			// Code should win
			const result = await cloneTestApply(
				makeOptions({
					migrations: [
						makeMigration('mig_001', {
							upFail: true,
							upError: 'something does not exist',
							upErrorCode: '23505',
						}),
					],
				}),
			);

			expect(result.suggestions.length).toBe(1);
			expect(result.suggestions[0]).toContain('dedup');
		});

		it('should fall back to string matching when no error code', async () => {
			const result = await cloneTestApply(
				makeOptions({
					migrations: [
						makeMigration('mig_001', {
							upFail: true,
							upError: 'violates foreign key constraint "fk_author"',
							// No error code — string matching fallback
						}),
					],
				}),
			);

			expect(result.suggestions.length).toBeGreaterThan(0);
			expect(result.suggestions[0]).toContain('Foreign key');
		});

		it('should fall back to string matching for unknown SQLSTATE codes', async () => {
			const result = await cloneTestApply(
				makeOptions({
					migrations: [
						makeMigration('mig_001', {
							upFail: true,
							upError: 'column "title" already exists',
							upErrorCode: '99999', // Unknown code
						}),
					],
				}),
			);

			expect(result.suggestions.length).toBeGreaterThan(0);
			expect(result.suggestions[0]).toContain('already exists');
		});

		it('should generate generic suggestion for unknown errors', async () => {
			const result = await cloneTestApply(
				makeOptions({
					migrations: [
						makeMigration('mig_001', {
							upFail: true,
							upError: 'something completely unexpected happened',
						}),
					],
				}),
			);

			expect(result.suggestions.length).toBeGreaterThan(0);
			expect(result.suggestions[0]).toContain('mig_001');
			expect(result.suggestions[0]).toContain('something completely unexpected');
		});
	});

	describe('test-only mode', () => {
		it('should skip applying to real DB when testOnly is true', async () => {
			const tracker = createInMemoryTracker();

			const result = await cloneTestApply(
				makeOptions({
					migrations: [makeMigration('mig_001')],
					testOnly: true,
					tracker,
				}),
			);

			expect(result.phase).toBe('skipped');
			expect(result.cloneResult).not.toBeNull();
			expect(result.cloneResult?.successCount).toBe(1);
			expect(result.applyResult).toBeNull();
			expect(result.cloneCleanedUp).toBe(true);
			// Real tracker should be empty
			expect(tracker.rows).toHaveLength(0);
		});
	});

	describe('no pending migrations', () => {
		it('should report no pending when all migrations already applied', async () => {
			const tracker = createInMemoryTracker();
			tracker.rows.push({
				id: '1',
				name: 'mig_001',
				batch: 1,
				checksum: 'abc',
				appliedAt: '2026-02-20T00:00:00Z',
				executionMs: 10,
			});

			const db = createMockDb();

			const result = await cloneTestApply(
				makeOptions({
					migrations: [makeMigration('mig_001')],
					db,
					tracker,
					// Clone tracker must also have it applied
					buildCloneTracker: () => {
						const cloneTracker = createInMemoryTracker();
						cloneTracker.rows.push({
							id: '1',
							name: 'mig_001',
							batch: 1,
							checksum: 'abc',
							appliedAt: '2026-02-20T00:00:00Z',
							executionMs: 10,
						});
						return cloneTracker;
					},
				}),
			);

			// Clone still gets created, but no migrations run
			expect(result.cloneResult).not.toBeNull();
			expect(result.cloneResult?.successCount).toBe(0);
			expect(result.cloneCleanedUp).toBe(true);
		});
	});

	describe('clone failure', () => {
		it('should handle clone database failure gracefully', async () => {
			const db = createMockDb();
			db.cloneDatabase = async (): Promise<string> => {
				throw new Error('Cannot create database: disk full');
			};

			const result = await cloneTestApply(
				makeOptions({
					migrations: [makeMigration('mig_001')],
					db,
				}),
			);

			expect(result.phase).toBe('clone');
			expect(result.error).toContain('disk full');
			expect(result.cloneResult).toBeNull();
			expect(result.applyResult).toBeNull();
		});

		it('should handle clone cleanup failure gracefully', async () => {
			const db = createMockDb();
			db.dropClone = async (): Promise<void> => {
				throw new Error('Cannot drop database');
			};

			const result = await cloneTestApply(
				makeOptions({
					migrations: [makeMigration('mig_001')],
					db,
				}),
			);

			// Pipeline still completes despite cleanup failure
			expect(result.phase).toBe('complete');
		});
	});

	describe('real DB apply failure', () => {
		it('should report error when real DB apply fails', async () => {
			let callCount = 0;
			const failOnSecondRun: LoadedMigration = {
				name: 'mig_fail_real',
				file: {
					meta: { name: 'mig_fail_real', description: 'fails on real db' },
					async up(): Promise<void> {
						callCount++;
						// First call is clone (succeeds), second is real (fails)
						if (callCount > 1) {
							throw new Error('Real DB locked');
						}
					},
					async down(): Promise<void> { /* noop */ },
				},
			};

			const result = await cloneTestApply(
				makeOptions({
					migrations: [failOnSecondRun],
				}),
			);

			expect(result.phase).toBe('apply');
			expect(result.error).toContain('Migration failed on real database');
			expect(result.cloneCleanedUp).toBe(true);
		});
	});

	describe('logging', () => {
		it('should log pipeline phases', async () => {
			const log = { info: vi.fn(), warn: vi.fn() };

			await cloneTestApply(
				makeOptions({
					migrations: [makeMigration('mig_001')],
					log,
				}),
			);

			const infoMessages = log.info.mock.calls.map((c: unknown[]) => c[0]);
			expect(infoMessages.some((m: string) => m.includes('Cloning database'))).toBe(true);
			expect(infoMessages.some((m: string) => m.includes('Clone created'))).toBe(true);
			expect(infoMessages.some((m: string) => m.includes('Running migrations on clone'))).toBe(true);
			expect(infoMessages.some((m: string) => m.includes('Clone test passed'))).toBe(true);
			expect(infoMessages.some((m: string) => m.includes('Applying migrations to real database'))).toBe(true);
			expect(infoMessages.some((m: string) => m.includes('Pipeline complete'))).toBe(true);
		});

		it('should log warnings on clone failure', async () => {
			const log = { info: vi.fn(), warn: vi.fn() };

			await cloneTestApply(
				makeOptions({
					migrations: [makeMigration('mig_001', { upFail: true })],
					log,
				}),
			);

			const warnMessages = log.warn.mock.calls.map((c: unknown[]) => c[0]);
			expect(warnMessages.some((m: string) => m.includes('Migration failed on clone'))).toBe(true);
			expect(warnMessages.some((m: string) => m.includes('Suggestions'))).toBe(true);
		});
	});
});
