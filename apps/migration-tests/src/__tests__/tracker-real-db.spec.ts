/**
 * Integration tests: Migration tracker against real databases.
 *
 * Verifies _momentum_migrations table CRUD actually works
 * on PostgreSQL and SQLite.
 */
import { Pool } from 'pg';
import Database from 'better-sqlite3';
import {
	ensureTrackingTable,
	getAppliedMigrations,
	getNextBatchNumber,
	getLatestBatchNumber,
	recordMigration,
	removeMigrationRecord,
	getMigrationsByBatch,
	isMigrationApplied,
} from '@momentumcms/migrations';
import {
	createTestPgDb,
	dropTestPgDb,
	createTestSqliteDb,
	dropTestSqliteDb,
} from '../helpers/test-db';
import { pgTracker, sqliteTracker } from '../helpers/adapter-wiring';
import { isPgAvailable } from '../helpers/pg-availability';

const pgAvailable = await isPgAvailable();

// ============================================
// PostgreSQL
// ============================================

describe.skipIf(!pgAvailable)('tracker-real-db (PostgreSQL)', () => {
	let pool: Pool;
	let dbName: string;

	beforeEach(async () => {
		const result = await createTestPgDb();
		dbName = result.dbName;
		pool = new Pool({ connectionString: result.connectionString, max: 5 });
	});

	afterEach(async () => {
		await pool.end();
		await dropTestPgDb(dbName);
	});

	it('should create the tracking table', async () => {
		const tracker = pgTracker(pool);
		await ensureTrackingTable(tracker, 'postgresql');

		// Verify via raw query
		const result = await pool.query(
			`SELECT table_name FROM information_schema.tables WHERE table_name = '_momentum_migrations'`,
		);
		expect(result.rows).toHaveLength(1);
	});

	it('should be idempotent (call twice without error)', async () => {
		const tracker = pgTracker(pool);
		await ensureTrackingTable(tracker, 'postgresql');
		await ensureTrackingTable(tracker, 'postgresql');

		const result = await pool.query(
			`SELECT table_name FROM information_schema.tables WHERE table_name = '_momentum_migrations'`,
		);
		expect(result.rows).toHaveLength(1);
	});

	it('should record a migration and verify via raw query', async () => {
		const tracker = pgTracker(pool);
		await ensureTrackingTable(tracker, 'postgresql');

		await recordMigration(
			tracker,
			{
				name: 'mig_001',
				batch: 1,
				checksum: 'abc123',
				appliedAt: '2026-02-20T00:00:00Z',
				executionMs: 42,
			},
			'postgresql',
		);

		const result = await pool.query(`SELECT * FROM "_momentum_migrations" WHERE "name" = $1`, [
			'mig_001',
		]);
		expect(result.rows).toHaveLength(1);
		expect(result.rows[0].name).toBe('mig_001');
		expect(result.rows[0].batch).toBe(1);
		expect(result.rows[0].checksum).toBe('abc123');
	});

	it('should return applied migrations in order', async () => {
		const tracker = pgTracker(pool);
		await ensureTrackingTable(tracker, 'postgresql');

		await recordMigration(
			tracker,
			{
				name: 'mig_002',
				batch: 1,
				checksum: 'b',
				appliedAt: '2026-02-20T01:00:00Z',
				executionMs: 10,
			},
			'postgresql',
		);
		await recordMigration(
			tracker,
			{
				name: 'mig_001',
				batch: 1,
				checksum: 'a',
				appliedAt: '2026-02-20T00:00:00Z',
				executionMs: 10,
			},
			'postgresql',
		);

		const applied = await getAppliedMigrations(tracker);
		expect(applied).toHaveLength(2);
		expect(applied[0].name).toBe('mig_001');
		expect(applied[1].name).toBe('mig_002');
	});

	it('should return correct next batch number', async () => {
		const tracker = pgTracker(pool);
		await ensureTrackingTable(tracker, 'postgresql');

		expect(await getNextBatchNumber(tracker)).toBe(1);

		await recordMigration(
			tracker,
			{
				name: 'mig_001',
				batch: 1,
				checksum: 'a',
				appliedAt: '2026-02-20T00:00:00Z',
				executionMs: 10,
			},
			'postgresql',
		);
		expect(await getNextBatchNumber(tracker)).toBe(2);

		await recordMigration(
			tracker,
			{
				name: 'mig_002',
				batch: 3,
				checksum: 'b',
				appliedAt: '2026-02-20T00:00:00Z',
				executionMs: 10,
			},
			'postgresql',
		);
		expect(await getNextBatchNumber(tracker)).toBe(4);
	});

	it('should remove a migration record', async () => {
		const tracker = pgTracker(pool);
		await ensureTrackingTable(tracker, 'postgresql');

		await recordMigration(
			tracker,
			{
				name: 'mig_001',
				batch: 1,
				checksum: 'a',
				appliedAt: '2026-02-20T00:00:00Z',
				executionMs: 10,
			},
			'postgresql',
		);
		await removeMigrationRecord(tracker, 'mig_001', 'postgresql');

		const result = await pool.query(`SELECT * FROM "_momentum_migrations" WHERE "name" = $1`, [
			'mig_001',
		]);
		expect(result.rows).toHaveLength(0);
	});

	it('should get migrations by batch in reverse name order', async () => {
		const tracker = pgTracker(pool);
		await ensureTrackingTable(tracker, 'postgresql');

		await recordMigration(
			tracker,
			{
				name: 'mig_001',
				batch: 1,
				checksum: 'a',
				appliedAt: '2026-02-20T00:00:00Z',
				executionMs: 10,
			},
			'postgresql',
		);
		await recordMigration(
			tracker,
			{
				name: 'mig_002',
				batch: 1,
				checksum: 'b',
				appliedAt: '2026-02-20T00:00:00Z',
				executionMs: 10,
			},
			'postgresql',
		);
		await recordMigration(
			tracker,
			{
				name: 'mig_003',
				batch: 2,
				checksum: 'c',
				appliedAt: '2026-02-20T00:00:00Z',
				executionMs: 10,
			},
			'postgresql',
		);

		const batch1 = await getMigrationsByBatch(tracker, 1, 'postgresql');
		expect(batch1).toHaveLength(2);
		expect(batch1[0].name).toBe('mig_002'); // reverse order
		expect(batch1[1].name).toBe('mig_001');
	});

	it('should check if a migration is applied', async () => {
		const tracker = pgTracker(pool);
		await ensureTrackingTable(tracker, 'postgresql');

		expect(await isMigrationApplied(tracker, 'mig_001', 'postgresql')).toBe(false);

		await recordMigration(
			tracker,
			{
				name: 'mig_001',
				batch: 1,
				checksum: 'a',
				appliedAt: '2026-02-20T00:00:00Z',
				executionMs: 10,
			},
			'postgresql',
		);
		expect(await isMigrationApplied(tracker, 'mig_001', 'postgresql')).toBe(true);
	});

	it('should return latest batch number', async () => {
		const tracker = pgTracker(pool);
		await ensureTrackingTable(tracker, 'postgresql');

		expect(await getLatestBatchNumber(tracker)).toBe(0);

		await recordMigration(
			tracker,
			{
				name: 'mig_001',
				batch: 1,
				checksum: 'a',
				appliedAt: '2026-02-20T00:00:00Z',
				executionMs: 10,
			},
			'postgresql',
		);
		expect(await getLatestBatchNumber(tracker)).toBe(1);

		await recordMigration(
			tracker,
			{
				name: 'mig_002',
				batch: 5,
				checksum: 'b',
				appliedAt: '2026-02-20T00:00:00Z',
				executionMs: 10,
			},
			'postgresql',
		);
		expect(await getLatestBatchNumber(tracker)).toBe(5);
	});
});

// ============================================
// SQLite
// ============================================

describe('tracker-real-db (SQLite)', () => {
	let db: Database.Database;
	let tempDir: string;

	beforeEach(async () => {
		const result = await createTestSqliteDb();
		tempDir = result.tempDir;
		db = new Database(result.dbPath);
		db.pragma('journal_mode = WAL');
	});

	afterEach(async () => {
		db.close();
		await dropTestSqliteDb(tempDir);
	});

	it('should create the tracking table', async () => {
		const tracker = sqliteTracker(db);
		await ensureTrackingTable(tracker, 'sqlite');

		const rows = db
			.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='_momentum_migrations'`)
			.all();
		expect(rows).toHaveLength(1);
	});

	it('should be idempotent (call twice without error)', async () => {
		const tracker = sqliteTracker(db);
		await ensureTrackingTable(tracker, 'sqlite');
		await ensureTrackingTable(tracker, 'sqlite');

		const rows = db
			.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='_momentum_migrations'`)
			.all();
		expect(rows).toHaveLength(1);
	});

	it('should record a migration and verify via raw query', async () => {
		const tracker = sqliteTracker(db);
		await ensureTrackingTable(tracker, 'sqlite');

		await recordMigration(
			tracker,
			{
				name: 'mig_001',
				batch: 1,
				checksum: 'abc123',
				appliedAt: '2026-02-20T00:00:00Z',
				executionMs: 42,
			},
			'sqlite',
		);

		const rows = db
			.prepare(`SELECT * FROM "_momentum_migrations" WHERE "name" = ?`)
			.all('mig_001') as Record<string, unknown>[];
		expect(rows).toHaveLength(1);
		expect(rows[0]['name']).toBe('mig_001');
		expect(rows[0]['batch']).toBe(1);
		expect(rows[0]['checksum']).toBe('abc123');
	});

	it('should return applied migrations in order', async () => {
		const tracker = sqliteTracker(db);
		await ensureTrackingTable(tracker, 'sqlite');

		await recordMigration(
			tracker,
			{
				name: 'mig_002',
				batch: 1,
				checksum: 'b',
				appliedAt: '2026-02-20T01:00:00Z',
				executionMs: 10,
			},
			'sqlite',
		);
		await recordMigration(
			tracker,
			{
				name: 'mig_001',
				batch: 1,
				checksum: 'a',
				appliedAt: '2026-02-20T00:00:00Z',
				executionMs: 10,
			},
			'sqlite',
		);

		const applied = await getAppliedMigrations(tracker);
		expect(applied).toHaveLength(2);
		expect(applied[0].name).toBe('mig_001');
		expect(applied[1].name).toBe('mig_002');
	});

	it('should return correct next batch number', async () => {
		const tracker = sqliteTracker(db);
		await ensureTrackingTable(tracker, 'sqlite');

		expect(await getNextBatchNumber(tracker)).toBe(1);

		await recordMigration(
			tracker,
			{
				name: 'mig_001',
				batch: 1,
				checksum: 'a',
				appliedAt: '2026-02-20T00:00:00Z',
				executionMs: 10,
			},
			'sqlite',
		);
		expect(await getNextBatchNumber(tracker)).toBe(2);
	});

	it('should remove a migration record', async () => {
		const tracker = sqliteTracker(db);
		await ensureTrackingTable(tracker, 'sqlite');

		await recordMigration(
			tracker,
			{
				name: 'mig_001',
				batch: 1,
				checksum: 'a',
				appliedAt: '2026-02-20T00:00:00Z',
				executionMs: 10,
			},
			'sqlite',
		);
		await removeMigrationRecord(tracker, 'mig_001', 'sqlite');

		const rows = db.prepare(`SELECT * FROM "_momentum_migrations" WHERE "name" = ?`).all('mig_001');
		expect(rows).toHaveLength(0);
	});

	it('should check if a migration is applied', async () => {
		const tracker = sqliteTracker(db);
		await ensureTrackingTable(tracker, 'sqlite');

		expect(await isMigrationApplied(tracker, 'mig_001', 'sqlite')).toBe(false);

		await recordMigration(
			tracker,
			{
				name: 'mig_001',
				batch: 1,
				checksum: 'a',
				appliedAt: '2026-02-20T00:00:00Z',
				executionMs: 10,
			},
			'sqlite',
		);
		expect(await isMigrationApplied(tracker, 'mig_001', 'sqlite')).toBe(true);
	});
});
