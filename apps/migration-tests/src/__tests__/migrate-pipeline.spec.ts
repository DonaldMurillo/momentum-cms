/**
 * Integration tests: Migrate pipeline against real databases.
 *
 * Tests runMigrations and rollbackBatch with real DDL statements,
 * verifying tables actually get created/dropped.
 */
import { Pool } from 'pg';
import Database from 'better-sqlite3';
import { runMigrations, rollbackBatch, getMigrationStatus } from '@momentumcms/migrations';
import type { LoadedMigration, MigrationContext } from '@momentumcms/migrations';
import {
	createTestPgDb,
	dropTestPgDb,
	createTestSqliteDb,
	dropTestSqliteDb,
} from '../helpers/test-db';
import {
	pgTracker,
	buildPgContext,
	sqliteTracker,
	buildSqliteContext,
} from '../helpers/adapter-wiring';
import { isPgAvailable } from '../helpers/pg-availability';

const pgAvailable = await isPgAvailable();

// ============================================
// Migration factories
// ============================================

function createTableMigration(
	tableName: string,
	dialect: 'postgresql' | 'sqlite',
): LoadedMigration {
	const idType = dialect === 'postgresql' ? 'VARCHAR(36)' : 'TEXT';
	const tsType = dialect === 'postgresql' ? 'TIMESTAMPTZ' : 'TEXT';

	return {
		name: `create_${tableName}`,
		file: {
			meta: { name: `create_${tableName}`, description: `Create ${tableName} table` },
			async up(ctx: MigrationContext): Promise<void> {
				await ctx.sql(
					`CREATE TABLE "${tableName}" ("id" ${idType} PRIMARY KEY, "title" ${idType} NOT NULL, "createdAt" ${tsType} NOT NULL DEFAULT ${dialect === 'postgresql' ? 'NOW()' : "(datetime('now'))"})`,
				);
			},
			async down(ctx: MigrationContext): Promise<void> {
				await ctx.sql(`DROP TABLE IF EXISTS "${tableName}"`);
			},
		},
	};
}

function addColumnMigration(tableName: string, column: string, colType: string): LoadedMigration {
	return {
		name: `add_${column}_to_${tableName}`,
		file: {
			meta: { name: `add_${column}_to_${tableName}`, description: `Add ${column}` },
			async up(ctx: MigrationContext): Promise<void> {
				await ctx.sql(`ALTER TABLE "${tableName}" ADD COLUMN "${column}" ${colType}`);
			},
			async down(ctx: MigrationContext): Promise<void> {
				await ctx.sql(`ALTER TABLE "${tableName}" DROP COLUMN "${column}"`);
			},
		},
	};
}

function failingMigration(name: string): LoadedMigration {
	return {
		name,
		file: {
			meta: { name, description: 'Intentionally fails' },
			async up(): Promise<void> {
				throw new Error('Intentional failure');
			},
			async down(): Promise<void> {
				/* noop */
			},
		},
	};
}

// ============================================
// PostgreSQL
// ============================================

describe.skipIf(!pgAvailable)('migrate-pipeline (PostgreSQL)', () => {
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

	it('should create table and tracking record after runMigrations', async () => {
		const tracker = pgTracker(pool);
		const result = await runMigrations({
			migrations: [createTableMigration('posts', 'postgresql')],
			dialect: 'postgresql',
			tracker,
			buildContext: () => buildPgContext(pool),
			skipDangerDetection: true,
		});

		expect(result.successCount).toBe(1);

		// Verify table exists
		const tables = await pool.query(
			`SELECT table_name FROM information_schema.tables WHERE table_name = 'posts'`,
		);
		expect(tables.rows).toHaveLength(1);

		// Verify tracking record
		const records = await pool.query(`SELECT * FROM "_momentum_migrations"`);
		expect(records.rows).toHaveLength(1);
		expect(records.rows[0].name).toBe('create_posts');
	});

	it('should rollback and remove table + tracking record', async () => {
		const tracker = pgTracker(pool);
		const migrations = [createTableMigration('posts', 'postgresql')];

		await runMigrations({
			migrations,
			dialect: 'postgresql',
			tracker,
			buildContext: () => buildPgContext(pool),
			skipDangerDetection: true,
		});

		const rollbackResult = await rollbackBatch({
			migrations,
			dialect: 'postgresql',
			tracker,
			buildContext: () => buildPgContext(pool),
			skipDangerDetection: true,
		});

		expect(rollbackResult.successCount).toBe(1);

		// Table should be gone
		const tables = await pool.query(
			`SELECT table_name FROM information_schema.tables WHERE table_name = 'posts'`,
		);
		expect(tables.rows).toHaveLength(0);

		// Tracking record should be gone
		const records = await pool.query(`SELECT * FROM "_momentum_migrations"`);
		expect(records.rows).toHaveLength(0);
	});

	it('should handle multiple batches and rollback only latest', async () => {
		const tracker = pgTracker(pool);

		// Batch 1: create posts
		await runMigrations({
			migrations: [createTableMigration('posts', 'postgresql')],
			dialect: 'postgresql',
			tracker,
			buildContext: () => buildPgContext(pool),
			skipDangerDetection: true,
		});

		// Batch 2: add column
		const allMigrations = [
			createTableMigration('posts', 'postgresql'),
			addColumnMigration('posts', 'status', 'TEXT'),
		];
		await runMigrations({
			migrations: allMigrations,
			dialect: 'postgresql',
			tracker,
			buildContext: () => buildPgContext(pool),
			skipDangerDetection: true,
		});

		// Rollback only batch 2
		await rollbackBatch({
			migrations: allMigrations,
			dialect: 'postgresql',
			tracker,
			buildContext: () => buildPgContext(pool),
			skipDangerDetection: true,
		});

		// posts table should still exist (batch 1)
		const tables = await pool.query(
			`SELECT table_name FROM information_schema.tables WHERE table_name = 'posts'`,
		);
		expect(tables.rows).toHaveLength(1);

		// But status column should be gone
		const cols = await pool.query(
			`SELECT column_name FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'status'`,
		);
		expect(cols.rows).toHaveLength(0);
	});

	it('should stop on first failure with preceding applied', async () => {
		const tracker = pgTracker(pool);
		const result = await runMigrations({
			migrations: [createTableMigration('posts', 'postgresql'), failingMigration('bad_migration')],
			dialect: 'postgresql',
			tracker,
			buildContext: () => buildPgContext(pool),
			skipDangerDetection: true,
		});

		expect(result.successCount).toBe(1);
		expect(result.failCount).toBe(1);

		// posts table should exist (first migration succeeded)
		const tables = await pool.query(
			`SELECT table_name FROM information_schema.tables WHERE table_name = 'posts'`,
		);
		expect(tables.rows).toHaveLength(1);
	});

	it('should report correct migration status', async () => {
		const tracker = pgTracker(pool);
		const migrations = [
			createTableMigration('posts', 'postgresql'),
			createTableMigration('users', 'postgresql'),
		];

		// Apply only first
		await runMigrations({
			migrations: [migrations[0]],
			dialect: 'postgresql',
			tracker,
			buildContext: () => buildPgContext(pool),
			skipDangerDetection: true,
		});

		const status = await getMigrationStatus(migrations, tracker, 'postgresql');
		expect(status).toHaveLength(2);
		expect(status[0].status).toBe('applied');
		expect(status[1].status).toBe('pending');
	});
});

// ============================================
// SQLite
// ============================================

describe('migrate-pipeline (SQLite)', () => {
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

	it('should create table and tracking record after runMigrations', async () => {
		const tracker = sqliteTracker(db);
		const result = await runMigrations({
			migrations: [createTableMigration('posts', 'sqlite')],
			dialect: 'sqlite',
			tracker,
			buildContext: () => buildSqliteContext(db),
			skipDangerDetection: true,
		});

		expect(result.successCount).toBe(1);

		// Verify table exists
		const tables = db
			.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='posts'`)
			.all();
		expect(tables).toHaveLength(1);

		// Verify tracking record
		const records = db.prepare(`SELECT * FROM "_momentum_migrations"`).all() as Record<
			string,
			unknown
		>[];
		expect(records).toHaveLength(1);
		expect(records[0]['name']).toBe('create_posts');
	});

	it('should rollback and remove table + tracking record', async () => {
		const tracker = sqliteTracker(db);
		const migrations = [createTableMigration('posts', 'sqlite')];

		await runMigrations({
			migrations,
			dialect: 'sqlite',
			tracker,
			buildContext: () => buildSqliteContext(db),
			skipDangerDetection: true,
		});

		await rollbackBatch({
			migrations,
			dialect: 'sqlite',
			tracker,
			buildContext: () => buildSqliteContext(db),
			skipDangerDetection: true,
		});

		// Table should be gone
		const tables = db
			.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='posts'`)
			.all();
		expect(tables).toHaveLength(0);

		// Tracking record should be gone
		const records = db.prepare(`SELECT * FROM "_momentum_migrations"`).all();
		expect(records).toHaveLength(0);
	});

	it('should handle full cycle: run, rollback, run again', async () => {
		const tracker = sqliteTracker(db);
		const migrations = [createTableMigration('posts', 'sqlite')];

		// Run
		await runMigrations({
			migrations,
			dialect: 'sqlite',
			tracker,
			buildContext: () => buildSqliteContext(db),
			skipDangerDetection: true,
		});

		// Rollback
		await rollbackBatch({
			migrations,
			dialect: 'sqlite',
			tracker,
			buildContext: () => buildSqliteContext(db),
			skipDangerDetection: true,
		});

		// Run again
		const result = await runMigrations({
			migrations,
			dialect: 'sqlite',
			tracker,
			buildContext: () => buildSqliteContext(db),
			skipDangerDetection: true,
		});

		expect(result.successCount).toBe(1);

		const tables = db
			.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='posts'`)
			.all();
		expect(tables).toHaveLength(1);
	});
});
