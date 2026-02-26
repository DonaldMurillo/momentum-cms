/**
 * Integration tests: Introspection roundtrip against real databases.
 *
 * Creates tables via raw SQL, introspects them, and verifies
 * the resulting snapshot is accurate.
 */
import { Pool } from 'pg';
import Database from 'better-sqlite3';
import type { TableSnapshot } from '@momentumcms/migrations';
import {
	introspectPostgres,
	introspectSqlite,
	ensureTrackingTable,
} from '@momentumcms/migrations';
import {
	createTestPgDb,
	dropTestPgDb,
	createTestSqliteDb,
	dropTestSqliteDb,
} from '../helpers/test-db';
import { pgQueryFn, pgTracker, sqliteQueryFn, sqliteTracker } from '../helpers/adapter-wiring';
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

// ============================================
// PostgreSQL
// ============================================

describe.skipIf(!pgAvailable)('introspection-roundtrip (PostgreSQL)', () => {
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

	it('should introspect a table created via raw SQL', async () => {
		await pool.query(`CREATE TABLE "posts" ("id" VARCHAR(36) PRIMARY KEY, "title" VARCHAR(255) NOT NULL, "body" TEXT, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW())`);

		const snapshot = await introspectPostgres(pgQueryFn(pool));

		const table = findTable(snapshot.tables, 'posts');
		expect(table).toBeDefined();
		expect(findColumn(table, 'id')).toBeDefined();
		expect(findColumn(table, 'title')?.nullable).toBe(false);
		expect(findColumn(table, 'body')?.nullable).toBe(true);
		expect(findColumn(table, 'createdAt')).toBeDefined();
	});

	it('should introspect foreign keys', async () => {
		await pool.query(`CREATE TABLE "authors" ("id" VARCHAR(36) PRIMARY KEY, "name" TEXT NOT NULL)`);
		await pool.query(`CREATE TABLE "articles" ("id" VARCHAR(36) PRIMARY KEY, "title" TEXT NOT NULL, "authorId" VARCHAR(36) REFERENCES "authors"("id") ON DELETE SET NULL)`);

		const snapshot = await introspectPostgres(pgQueryFn(pool));

		const articlesTable = findTable(snapshot.tables, 'articles');
		expect(articlesTable).toBeDefined();
		expect(articlesTable?.foreignKeys).toBeDefined();
		const fks = articlesTable?.foreignKeys;
		expect(fks.length).toBeGreaterThan(0);
		const fk = fks[0];
		expect(fk.column).toBe('authorId');
		expect(fk.referencedTable).toBe('authors');
		expect(fk.referencedColumn).toBe('id');
	});

	it('should introspect indexes', async () => {
		await pool.query(`CREATE TABLE "users" ("id" VARCHAR(36) PRIMARY KEY, "email" VARCHAR(255) NOT NULL)`);
		await pool.query(`CREATE UNIQUE INDEX "users_email_idx" ON "users" ("email")`);

		const snapshot = await introspectPostgres(pgQueryFn(pool));

		const usersTable = findTable(snapshot.tables, 'users');
		expect(usersTable).toBeDefined();
		const emailIdx = usersTable?.indexes.find((i) => i.name === 'users_email_idx');
		expect(emailIdx).toBeDefined();
		expect(emailIdx?.unique).toBe(true);
		expect(emailIdx?.columns).toContain('email');
	});

	it('should exclude internal tables', async () => {
		const tracker = pgTracker(pool);
		await ensureTrackingTable(tracker, 'postgresql');
		await pool.query(`CREATE TABLE "posts" ("id" VARCHAR(36) PRIMARY KEY)`);

		const snapshot = await introspectPostgres(pgQueryFn(pool));

		expect(findTable(snapshot.tables, 'posts')).toBeDefined();
		expect(findTable(snapshot.tables, '_momentum_migrations')).toBeUndefined();
	});

	it('should return empty snapshot for empty database', async () => {
		const snapshot = await introspectPostgres(pgQueryFn(pool));
		expect(snapshot.tables).toHaveLength(0);
	});

	it('should detect nullable vs NOT NULL correctly', async () => {
		await pool.query(`CREATE TABLE "mixed" ("id" VARCHAR(36) PRIMARY KEY, "required_col" TEXT NOT NULL, "optional_col" TEXT, "has_default" TEXT NOT NULL DEFAULT 'hello')`);

		const snapshot = await introspectPostgres(pgQueryFn(pool));
		const table = findTable(snapshot.tables, 'mixed');
		expect(table).toBeDefined();

		expect(findColumn(table, 'required_col')?.nullable).toBe(false);
		expect(findColumn(table, 'optional_col')?.nullable).toBe(true);
		expect(findColumn(table, 'has_default')?.nullable).toBe(false);
	});
});

// ============================================
// SQLite
// ============================================

describe('introspection-roundtrip (SQLite)', () => {
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

	it('should introspect a table created via raw SQL', async () => {
		db.prepare(`CREATE TABLE "posts" ("id" TEXT PRIMARY KEY, "title" TEXT NOT NULL, "body" TEXT, "createdAt" TEXT NOT NULL)`).run();

		const snapshot = await introspectSqlite(sqliteQueryFn(db));

		const table = findTable(snapshot.tables, 'posts');
		expect(table).toBeDefined();
		expect(findColumn(table, 'id')).toBeDefined();
		expect(findColumn(table, 'title')?.nullable).toBe(false);
		expect(findColumn(table, 'body')?.nullable).toBe(true);
	});

	it('should introspect indexes', async () => {
		db.prepare(`CREATE TABLE "users" ("id" TEXT PRIMARY KEY, "email" TEXT NOT NULL)`).run();
		db.prepare(`CREATE UNIQUE INDEX "users_email_idx" ON "users" ("email")`).run();

		const snapshot = await introspectSqlite(sqliteQueryFn(db));

		const usersTable = findTable(snapshot.tables, 'users');
		expect(usersTable).toBeDefined();
		const emailIdx = usersTable?.indexes.find((i) => i.name === 'users_email_idx');
		expect(emailIdx).toBeDefined();
		expect(emailIdx?.unique).toBe(true);
		expect(emailIdx?.columns).toContain('email');
	});

	it('should exclude internal tables', async () => {
		const tracker = sqliteTracker(db);
		await ensureTrackingTable(tracker, 'sqlite');
		db.prepare(`CREATE TABLE "posts" ("id" TEXT PRIMARY KEY)`).run();

		const snapshot = await introspectSqlite(sqliteQueryFn(db));

		expect(findTable(snapshot.tables, 'posts')).toBeDefined();
		expect(findTable(snapshot.tables, '_momentum_migrations')).toBeUndefined();
	});

	it('should return empty snapshot for empty database', async () => {
		const snapshot = await introspectSqlite(sqliteQueryFn(db));
		expect(snapshot.tables).toHaveLength(0);
	});
});
