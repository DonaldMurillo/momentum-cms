import { describe, it, expect, beforeEach } from 'vitest';
import {
	ensureTrackingTable,
	getAppliedMigrations,
	getNextBatchNumber,
	recordMigration,
	removeMigrationRecord,
	getMigrationsByBatch,
	getLatestBatchNumber,
	isMigrationApplied,
} from '../migration-tracker';
import type { TrackerQueryFn } from '../migration-tracker';

/**
 * In-memory implementation of TrackerQueryFn for testing.
 * Simulates a simple table store without needing a real database.
 */
function createInMemoryTracker(): TrackerQueryFn & { rows: Record<string, unknown>[] } {
	const rows: Record<string, unknown>[] = [];

	return {
		rows,
		async query<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
			// Simple pattern matching for the queries we use
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

			// SELECT * — return all, sorted by batch then name
			const sorted = [...rows].sort((a, b) => {
				const batchDiff = Number(a['batch']) - Number(b['batch']);
				if (batchDiff !== 0) return batchDiff;
				return String(a['name']).localeCompare(String(b['name']));
			});
			return sorted as T[];
		},

		async execute(sql: string, params?: unknown[]): Promise<number> {
			if (sql.includes('CREATE TABLE')) {
				return 0; // Table creation is a no-op for in-memory
			}

			if (sql.includes('INSERT INTO')) {
				const row: Record<string, unknown> = {};
				if (params) {
					const fields = ['id', 'name', 'batch', 'checksum', 'appliedAt', 'executionMs'];
					fields.forEach((f, i) => {
						row[f] = params[i];
					});
				}
				rows.push(row);
				return 1;
			}

			if (sql.includes('DELETE FROM') && sql.includes('WHERE "name"')) {
				const name = params?.[0];
				const idx = rows.findIndex((r) => r['name'] === name);
				if (idx >= 0) {
					rows.splice(idx, 1);
					return 1;
				}
				return 0;
			}

			return 0;
		},
	};
}

describe('migration-tracker', () => {
	let db: ReturnType<typeof createInMemoryTracker>;

	beforeEach(() => {
		db = createInMemoryTracker();
	});

	describe('ensureTrackingTable', () => {
		it('should not throw for postgresql', async () => {
			await expect(ensureTrackingTable(db, 'postgresql')).resolves.not.toThrow();
		});

		it('should not throw for sqlite', async () => {
			await expect(ensureTrackingTable(db, 'sqlite')).resolves.not.toThrow();
		});
	});

	describe('getAppliedMigrations', () => {
		it('should return empty array when no migrations applied', async () => {
			const migrations = await getAppliedMigrations(db);
			expect(migrations).toEqual([]);
		});

		it('should return applied migrations ordered by batch and name', async () => {
			await recordMigration(
				db,
				{
					name: '20260220_b_second',
					batch: 1,
					checksum: 'abc',
					appliedAt: '2026-02-20T00:00:00Z',
					executionMs: 50,
				},
				'postgresql',
			);
			await recordMigration(
				db,
				{
					name: '20260220_a_first',
					batch: 1,
					checksum: 'def',
					appliedAt: '2026-02-20T00:00:01Z',
					executionMs: 30,
				},
				'postgresql',
			);

			const migrations = await getAppliedMigrations(db);
			expect(migrations).toHaveLength(2);
			expect(migrations[0].name).toBe('20260220_a_first');
			expect(migrations[1].name).toBe('20260220_b_second');
		});
	});

	describe('getNextBatchNumber', () => {
		it('should return 1 when no migrations exist', async () => {
			const batch = await getNextBatchNumber(db);
			expect(batch).toBe(1);
		});

		it('should return max_batch + 1', async () => {
			await recordMigration(
				db,
				{
					name: 'mig1',
					batch: 3,
					checksum: 'abc',
					appliedAt: '2026-02-20T00:00:00Z',
					executionMs: 10,
				},
				'postgresql',
			);
			const batch = await getNextBatchNumber(db);
			expect(batch).toBe(4);
		});
	});

	describe('recordMigration', () => {
		it('should record a migration and return full record with id', async () => {
			const record = await recordMigration(
				db,
				{
					name: 'test_migration',
					batch: 1,
					checksum: 'sha256hash',
					appliedAt: '2026-02-20T14:30:00Z',
					executionMs: 100,
				},
				'postgresql',
			);

			expect(record.id).toBeTruthy();
			expect(record.name).toBe('test_migration');
			expect(record.batch).toBe(1);
			expect(record.checksum).toBe('sha256hash');
			expect(record.executionMs).toBe(100);
		});

		it('should persist the record', async () => {
			await recordMigration(
				db,
				{
					name: 'persisted',
					batch: 1,
					checksum: 'abc',
					appliedAt: '2026-02-20T00:00:00Z',
					executionMs: 5,
				},
				'postgresql',
			);

			const migrations = await getAppliedMigrations(db);
			expect(migrations).toHaveLength(1);
			expect(migrations[0].name).toBe('persisted');
		});
	});

	describe('removeMigrationRecord', () => {
		it('should remove an existing migration record', async () => {
			await recordMigration(
				db,
				{
					name: 'to_remove',
					batch: 1,
					checksum: 'abc',
					appliedAt: '2026-02-20T00:00:00Z',
					executionMs: 10,
				},
				'postgresql',
			);

			const removed = await removeMigrationRecord(db, 'to_remove', 'postgresql');
			expect(removed).toBe(true);

			const migrations = await getAppliedMigrations(db);
			expect(migrations).toHaveLength(0);
		});

		it('should return false when migration does not exist', async () => {
			const removed = await removeMigrationRecord(db, 'nonexistent', 'postgresql');
			expect(removed).toBe(false);
		});
	});

	describe('getMigrationsByBatch', () => {
		it('should return migrations for a specific batch in reverse name order', async () => {
			await recordMigration(
				db,
				{ name: 'a_first', batch: 1, checksum: 'a', appliedAt: '2026-02-20T00:00:00Z', executionMs: 10 },
				'postgresql',
			);
			await recordMigration(
				db,
				{ name: 'b_second', batch: 1, checksum: 'b', appliedAt: '2026-02-20T00:00:00Z', executionMs: 10 },
				'postgresql',
			);
			await recordMigration(
				db,
				{ name: 'c_other_batch', batch: 2, checksum: 'c', appliedAt: '2026-02-20T00:00:00Z', executionMs: 10 },
				'postgresql',
			);

			const batch1 = await getMigrationsByBatch(db, 1, 'postgresql');
			expect(batch1).toHaveLength(2);
			// Should be in reverse name order for rollback
			expect(batch1[0].name).toBe('b_second');
			expect(batch1[1].name).toBe('a_first');
		});
	});

	describe('getLatestBatchNumber', () => {
		it('should return 0 when no migrations exist', async () => {
			const batch = await getLatestBatchNumber(db);
			expect(batch).toBe(0);
		});

		it('should return the highest batch number', async () => {
			await recordMigration(
				db,
				{ name: 'a', batch: 2, checksum: 'x', appliedAt: '2026-02-20T00:00:00Z', executionMs: 5 },
				'postgresql',
			);
			await recordMigration(
				db,
				{ name: 'b', batch: 5, checksum: 'y', appliedAt: '2026-02-20T00:00:00Z', executionMs: 5 },
				'postgresql',
			);

			const batch = await getLatestBatchNumber(db);
			expect(batch).toBe(5);
		});
	});

	describe('isMigrationApplied', () => {
		it('should return false when migration not applied', async () => {
			const applied = await isMigrationApplied(db, 'nonexistent', 'postgresql');
			expect(applied).toBe(false);
		});

		it('should return true when migration is applied', async () => {
			await recordMigration(
				db,
				{ name: 'applied_one', batch: 1, checksum: 'x', appliedAt: '2026-02-20T00:00:00Z', executionMs: 5 },
				'postgresql',
			);

			const applied = await isMigrationApplied(db, 'applied_one', 'postgresql');
			expect(applied).toBe(true);
		});
	});
});
