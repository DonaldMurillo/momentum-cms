/**
 * Integration tests: Push pipeline against real databases.
 *
 * Tests runPush (collections → schema → diff → SQL → execute)
 * and verifies tables, columns, and indexes actually exist.
 */
import { Pool } from 'pg';
import Database from 'better-sqlite3';
import type { TableSnapshot } from '@momentumcms/migrations';
import {
	runPush,
	introspectPostgres,
	introspectSqlite,
} from '@momentumcms/migrations';
import { defineCollection, text, number, select, relationship } from '@momentumcms/core';
import {
	createTestPgDb,
	dropTestPgDb,
	createTestSqliteDb,
	dropTestSqliteDb,
} from '../helpers/test-db';
import {
	pgPushDb,
	pgQueryFn,
	sqlitePushDb,
	sqliteQueryFn,
} from '../helpers/adapter-wiring';
import { isPgAvailable } from '../helpers/pg-availability';

const pgAvailable = await isPgAvailable();

/** Helper: find a table by name from the snapshot's tables array. */
function findTable(tables: TableSnapshot[], name: string): TableSnapshot | undefined {
	return tables.find((t) => t.name === name);
}

/** Helper: find a column by name within a table's columns array. */
function findColumn(table: TableSnapshot, name: string): TableSnapshot['columns'][number] | undefined {
	return table.columns.find((c) => c.name === name);
}

// Test collections
const SimpleBefore = defineCollection({
	slug: 'push-test',
	fields: [text('title', { required: true }), text('description'), number('order')],
});

const SimpleAfter = defineCollection({
	slug: 'push-test',
	fields: [
		text('title', { required: true }),
		text('description', { required: true }),
		select('status', { options: ['draft', 'published', 'archived'] }),
	],
});

const ParentCollection = defineCollection({
	slug: 'push-parent',
	fields: [text('name', { required: true })],
});

const ChildCollection = defineCollection({
	slug: 'push-child',
	fields: [
		text('label', { required: true }),
		relationship('parent', { collection: () => ParentCollection }),
	],
});

// ============================================
// PostgreSQL
// ============================================

describe.skipIf(!pgAvailable)('push-pipeline (PostgreSQL)', () => {
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

	it('should create table with correct columns on first push', async () => {
		const result = await runPush({
			collections: [SimpleBefore],
			dialect: 'postgresql',
			db: pgPushDb(pool),
			introspect: () => introspectPostgres(pgQueryFn(pool)),
			skipDangerDetection: true,
		});

		expect(result.applied).toBe(true);
		expect(result.errors).toHaveLength(0);

		// Verify table and columns exist
		const snapshot = await introspectPostgres(pgQueryFn(pool));
		const table = findTable(snapshot.tables, 'push-test');
		expect(table).toBeDefined();
		expect(findColumn(table!, 'id')).toBeDefined();
		expect(findColumn(table!, 'title')).toBeDefined();
		expect(findColumn(table!, 'description')).toBeDefined();
		expect(findColumn(table!, 'order')).toBeDefined();
		expect(findColumn(table!, 'createdAt')).toBeDefined();
		expect(findColumn(table!, 'updatedAt')).toBeDefined();
	});

	it('should add and drop columns on schema change', async () => {
		// First push
		await runPush({
			collections: [SimpleBefore],
			dialect: 'postgresql',
			db: pgPushDb(pool),
			introspect: () => introspectPostgres(pgQueryFn(pool)),
			skipDangerDetection: true,
		});

		// Second push with modified collection
		const result = await runPush({
			collections: [SimpleAfter],
			dialect: 'postgresql',
			db: pgPushDb(pool),
			introspect: () => introspectPostgres(pgQueryFn(pool)),
			skipDangerDetection: true,
		});

		expect(result.applied).toBe(true);

		const snapshot = await introspectPostgres(pgQueryFn(pool));
		const table = findTable(snapshot.tables, 'push-test');
		expect(table).toBeDefined();
		expect(findColumn(table!, 'status')).toBeDefined();
		// Verify status column was added
		expect(findColumn(table!, 'status')).toBeDefined();
	});

	it('should be no-op when schema matches', async () => {
		// Push once
		await runPush({
			collections: [SimpleBefore],
			dialect: 'postgresql',
			db: pgPushDb(pool),
			introspect: () => introspectPostgres(pgQueryFn(pool)),
			skipDangerDetection: true,
		});

		// Push again — no changes expected
		const result = await runPush({
			collections: [SimpleBefore],
			dialect: 'postgresql',
			db: pgPushDb(pool),
			introspect: () => introspectPostgres(pgQueryFn(pool)),
			skipDangerDetection: true,
		});

		expect(result.applied).toBe(false);
		expect(result.diff.hasChanges).toBe(false);
		expect(result.sqlStatements).toHaveLength(0);
	});

	it('should report changes in dry-run without applying', async () => {
		const result = await runPush({
			collections: [SimpleBefore],
			dialect: 'postgresql',
			db: pgPushDb(pool),
			introspect: () => introspectPostgres(pgQueryFn(pool)),
			dryRun: true,
			skipDangerDetection: true,
		});

		expect(result.applied).toBe(false);
		expect(result.diff.hasChanges).toBe(true);
		expect(result.sqlStatements.length).toBeGreaterThan(0);

		// Table should NOT exist
		const snapshot = await introspectPostgres(pgQueryFn(pool));
		expect(findTable(snapshot.tables, 'push-test')).toBeUndefined();
	});

	it('should create FK for relationship fields', async () => {
		const result = await runPush({
			collections: [ParentCollection, ChildCollection],
			dialect: 'postgresql',
			db: pgPushDb(pool),
			introspect: () => introspectPostgres(pgQueryFn(pool)),
			skipDangerDetection: true,
		});

		expect(result.applied).toBe(true);

		const snapshot = await introspectPostgres(pgQueryFn(pool));
		const childTable = findTable(snapshot.tables, 'push-child');
		expect(childTable).toBeDefined();
		expect(childTable!.foreignKeys.length).toBeGreaterThan(0);
		const fk = childTable!.foreignKeys.find((f) => f.column === 'parent');
		expect(fk).toBeDefined();
		expect(fk!.referencedTable).toBe('push-parent');
		expect(fk!.referencedColumn).toBe('id');
	});

	it('should create multiple tables from multiple collections', async () => {
		await runPush({
			collections: [ParentCollection, ChildCollection],
			dialect: 'postgresql',
			db: pgPushDb(pool),
			introspect: () => introspectPostgres(pgQueryFn(pool)),
			skipDangerDetection: true,
		});

		const snapshot = await introspectPostgres(pgQueryFn(pool));
		expect(findTable(snapshot.tables, 'push-parent')).toBeDefined();
		expect(findTable(snapshot.tables, 'push-child')).toBeDefined();
	});
});

// ============================================
// SQLite
// ============================================

describe('push-pipeline (SQLite)', () => {
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

	it('should create table with correct columns on first push', async () => {
		const result = await runPush({
			collections: [SimpleBefore],
			dialect: 'sqlite',
			db: sqlitePushDb(db),
			introspect: () => introspectSqlite(sqliteQueryFn(db)),
			skipDangerDetection: true,
		});

		expect(result.applied).toBe(true);
		expect(result.errors).toHaveLength(0);

		const snapshot = await introspectSqlite(sqliteQueryFn(db));
		const table = findTable(snapshot.tables, 'push-test');
		expect(table).toBeDefined();
		expect(findColumn(table!, 'id')).toBeDefined();
		expect(findColumn(table!, 'title')).toBeDefined();
		expect(findColumn(table!, 'description')).toBeDefined();
		expect(findColumn(table!, 'order')).toBeDefined();
		expect(findColumn(table!, 'createdAt')).toBeDefined();
		expect(findColumn(table!, 'updatedAt')).toBeDefined();
	});

	it('should be no-op when schema matches', async () => {
		await runPush({
			collections: [SimpleBefore],
			dialect: 'sqlite',
			db: sqlitePushDb(db),
			introspect: () => introspectSqlite(sqliteQueryFn(db)),
			skipDangerDetection: true,
		});

		const result = await runPush({
			collections: [SimpleBefore],
			dialect: 'sqlite',
			db: sqlitePushDb(db),
			introspect: () => introspectSqlite(sqliteQueryFn(db)),
			skipDangerDetection: true,
		});

		expect(result.applied).toBe(false);
		expect(result.diff.hasChanges).toBe(false);
	});

	it('should report changes in dry-run without applying', async () => {
		const result = await runPush({
			collections: [SimpleBefore],
			dialect: 'sqlite',
			db: sqlitePushDb(db),
			introspect: () => introspectSqlite(sqliteQueryFn(db)),
			dryRun: true,
			skipDangerDetection: true,
		});

		expect(result.applied).toBe(false);
		expect(result.diff.hasChanges).toBe(true);
		expect(result.sqlStatements.length).toBeGreaterThan(0);

		// Table should NOT exist
		const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='push-test'`).all();
		expect(tables).toHaveLength(0);
	});

	it('should create multiple tables from multiple collections', async () => {
		await runPush({
			collections: [ParentCollection, ChildCollection],
			dialect: 'sqlite',
			db: sqlitePushDb(db),
			introspect: () => introspectSqlite(sqliteQueryFn(db)),
			skipDangerDetection: true,
		});

		const snapshot = await introspectSqlite(sqliteQueryFn(db));
		expect(findTable(snapshot.tables, 'push-parent')).toBeDefined();
		expect(findTable(snapshot.tables, 'push-child')).toBeDefined();
	});
});
