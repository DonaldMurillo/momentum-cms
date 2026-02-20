/**
 * Integration tests: Data migration helpers against real databases.
 *
 * Pre-populates tables with test data (including NULLs and duplicates),
 * runs helpers, and verifies data transformations via raw queries.
 */
import { Pool } from 'pg';
import Database from 'better-sqlite3';
import { createDataHelpers } from '@momentumcms/migrations';
import type { DataHelperDb } from '@momentumcms/migrations';
import {
	createTestPgDb,
	dropTestPgDb,
	createTestSqliteDb,
	dropTestSqliteDb,
} from '../helpers/test-db';
import { pgDataDb, sqliteDataDb } from '../helpers/adapter-wiring';
import { isPgAvailable } from '../helpers/pg-availability';

const pgAvailable = await isPgAvailable();

interface CountRow {
	[key: string]: unknown;
	cnt: string | number;
}

// ============================================
// PostgreSQL
// ============================================

describe.skipIf(!pgAvailable)('data-helpers-real (PostgreSQL)', () => {
	let pool: Pool;
	let dbName: string;
	let db: DataHelperDb;

	beforeEach(async () => {
		const result = await createTestPgDb();
		dbName = result.dbName;
		pool = new Pool({ connectionString: result.connectionString, max: 5 });
		db = pgDataDb(pool);
	});

	afterEach(async () => {
		await pool.end();
		await dropTestPgDb(dbName);
	});

	async function createPostsTable(): Promise<void> {
		await pool.query(`
			CREATE TABLE "posts" (
				"id" VARCHAR(36) PRIMARY KEY,
				"title" TEXT NOT NULL,
				"status" TEXT,
				"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`);
	}

	async function seedPosts(): Promise<void> {
		await pool.query(`INSERT INTO "posts" ("id", "title", "status") VALUES ('1', 'Post A', NULL), ('2', 'Post B', NULL), ('3', 'Post C', 'published'), ('4', 'Post D', NULL), ('5', 'Post E', 'draft')`);
	}

	it('backfill should fill NULL values', async () => {
		await createPostsTable();
		await seedPosts();

		const helpers = createDataHelpers(db, 'postgresql');
		const affected = await helpers.backfill('posts', 'status', 'draft');

		expect(affected).toBe(3);

		const result = await pool.query(`SELECT COUNT(*) as cnt FROM "posts" WHERE "status" IS NULL`);
		expect(Number(result.rows[0].cnt)).toBe(0);
	});

	it('backfill with WHERE clause should fill only matching rows', async () => {
		await createPostsTable();
		await seedPosts();

		const helpers = createDataHelpers(db, 'postgresql');
		const affected = await helpers.backfill('posts', 'status', 'archived', {
			where: `"title" = 'Post A'`,
		});

		expect(affected).toBe(1);

		const result = await pool.query(`SELECT "status" FROM "posts" WHERE "id" = '1'`);
		expect(result.rows[0].status).toBe('archived');

		// Other NULLs should remain
		const nullCount = await pool.query(`SELECT COUNT(*) as cnt FROM "posts" WHERE "status" IS NULL`);
		expect(Number(nullCount.rows[0].cnt)).toBe(2);
	});

	it('transform should apply SQL expression', async () => {
		await createPostsTable();
		await pool.query(`INSERT INTO "posts" ("id", "title", "status") VALUES ('1', 'hello', 'draft'), ('2', 'world', 'draft')`);

		const helpers = createDataHelpers(db, 'postgresql');
		const affected = await helpers.transform('posts', 'title', `UPPER("title")`);

		expect(affected).toBe(2);

		const result = await pool.query(`SELECT "title" FROM "posts" ORDER BY "id"`);
		expect(result.rows[0].title).toBe('HELLO');
		expect(result.rows[1].title).toBe('WORLD');
	});

	it('renameColumn should move data to new column', async () => {
		await createPostsTable();
		await pool.query(`INSERT INTO "posts" ("id", "title", "status") VALUES ('1', 'Test', 'active')`);

		const helpers = createDataHelpers(db, 'postgresql');
		await helpers.renameColumn('posts', 'status', 'state', 'TEXT');

		// New column should have the data
		const result = await pool.query(`SELECT "state" FROM "posts" WHERE "id" = '1'`);
		expect(result.rows[0].state).toBe('active');

		// Old column should be gone
		const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'status'`);
		expect(cols.rows).toHaveLength(0);
	});

	it('splitColumn should create target columns with expressions', async () => {
		await pool.query(`CREATE TABLE "people" ("id" VARCHAR(36) PRIMARY KEY, "fullName" TEXT NOT NULL)`);
		await pool.query(`INSERT INTO "people" ("id", "fullName") VALUES ('1', 'John Doe'), ('2', 'Jane Smith')`);

		const helpers = createDataHelpers(db, 'postgresql');
		await helpers.splitColumn('people', 'fullName', [
			{ name: 'firstName', type: 'TEXT', expression: `split_part("fullName", ' ', 1)` },
			{ name: 'lastName', type: 'TEXT', expression: `split_part("fullName", ' ', 2)` },
		]);

		const result = await pool.query(`SELECT "firstName", "lastName" FROM "people" ORDER BY "id"`);
		expect(result.rows[0].firstName).toBe('John');
		expect(result.rows[0].lastName).toBe('Doe');
		expect(result.rows[1].firstName).toBe('Jane');
		expect(result.rows[1].lastName).toBe('Smith');
	});

	it('mergeColumns should combine into a new column', async () => {
		await pool.query(`CREATE TABLE "contacts" ("id" VARCHAR(36) PRIMARY KEY, "firstName" TEXT, "lastName" TEXT)`);
		await pool.query(`INSERT INTO "contacts" ("id", "firstName", "lastName") VALUES ('1', 'John', 'Doe')`);

		const helpers = createDataHelpers(db, 'postgresql');
		await helpers.mergeColumns(
			'contacts',
			['firstName', 'lastName'],
			'fullName',
			'TEXT',
			`"firstName" || ' ' || "lastName"`,
		);

		const result = await pool.query(`SELECT "fullName" FROM "contacts" WHERE "id" = '1'`);
		expect(result.rows[0].fullName).toBe('John Doe');
	});

	it('copyData should copy rows between tables', async () => {
		await pool.query(`CREATE TABLE "source" ("id" VARCHAR(36) PRIMARY KEY, "name" TEXT, "value" INT)`);
		await pool.query(`CREATE TABLE "target" ("id" VARCHAR(36) PRIMARY KEY, "label" TEXT, "amount" INT)`);
		await pool.query(`INSERT INTO "source" ("id", "name", "value") VALUES ('1', 'A', 10), ('2', 'B', 20)`);

		const helpers = createDataHelpers(db, 'postgresql');
		const affected = await helpers.copyData('source', 'target', {
			id: 'id',
			label: 'name',
			amount: 'value',
		});

		expect(affected).toBe(2);

		const result = await pool.query(`SELECT "label", "amount" FROM "target" ORDER BY "id"`);
		expect(result.rows[0].label).toBe('A');
		expect(result.rows[0].amount).toBe(10);
	});

	it('columnToJson and jsonToColumn should roundtrip', async () => {
		await pool.query(`CREATE TABLE "settings" ("id" VARCHAR(36) PRIMARY KEY, "theme" TEXT, "meta" JSONB DEFAULT '{}'::jsonb)`);
		await pool.query(`INSERT INTO "settings" ("id", "theme") VALUES ('1', 'dark')`);

		const helpers = createDataHelpers(db, 'postgresql');

		// Column → JSON
		await helpers.columnToJson('settings', 'theme', 'meta', 'theme');

		const jsonResult = await pool.query(`SELECT "meta"->>'theme' as theme_val FROM "settings" WHERE "id" = '1'`);
		expect(jsonResult.rows[0].theme_val).toBe('dark');

		// JSON → Column
		await helpers.jsonToColumn('settings', 'meta', 'theme', 'extracted_theme', 'TEXT');

		const colResult = await pool.query(`SELECT "extracted_theme" FROM "settings" WHERE "id" = '1'`);
		expect(colResult.rows[0].extracted_theme).toBe('dark');
	});

	it('dedup should remove duplicate rows', async () => {
		await pool.query(`CREATE TABLE "emails" ("id" VARCHAR(36) PRIMARY KEY, "email" TEXT, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
		await pool.query(`INSERT INTO "emails" ("id", "email", "createdAt") VALUES ('1', 'a@test.com', '2026-01-01'), ('2', 'a@test.com', '2026-01-02'), ('3', 'b@test.com', '2026-01-01'), ('4', 'a@test.com', '2026-01-03')`);

		const helpers = createDataHelpers(db, 'postgresql');
		const removed = await helpers.dedup('emails', ['email'], 'latest');

		expect(removed).toBe(2);

		const result = await pool.query(`SELECT COUNT(*) as cnt FROM "emails"`);
		expect(Number(result.rows[0].cnt)).toBe(2);

		// Should keep the latest 'a@test.com' (id=4) and only 'b@test.com' (id=3)
		const emails = await pool.query(`SELECT "email" FROM "emails" ORDER BY "email"`);
		expect(emails.rows).toHaveLength(2);
	});
});

// ============================================
// SQLite
// ============================================

describe('data-helpers-real (SQLite)', () => {
	let sqliteDb: Database.Database;
	let tempDir: string;
	let db: DataHelperDb;

	beforeEach(async () => {
		const result = await createTestSqliteDb();
		tempDir = result.tempDir;
		sqliteDb = new Database(result.dbPath);
		sqliteDb.pragma('journal_mode = WAL');
		db = sqliteDataDb(sqliteDb);
	});

	afterEach(async () => {
		sqliteDb.close();
		await dropTestSqliteDb(tempDir);
	});

	function createPostsTable(): void {
		sqliteDb.prepare(`
			CREATE TABLE "posts" (
				"id" TEXT PRIMARY KEY,
				"title" TEXT NOT NULL,
				"status" TEXT,
				"createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
			)
		`).run();
	}

	function seedPosts(): void {
		sqliteDb.prepare(`INSERT INTO "posts" ("id", "title", "status") VALUES ('1', 'Post A', NULL), ('2', 'Post B', NULL), ('3', 'Post C', 'published'), ('4', 'Post D', NULL), ('5', 'Post E', 'draft')`).run();
	}

	it('backfill should fill NULL values', async () => {
		createPostsTable();
		seedPosts();

		const helpers = createDataHelpers(db, 'sqlite');
		const affected = await helpers.backfill('posts', 'status', 'draft');

		expect(affected).toBe(3);

		const result = sqliteDb.prepare(`SELECT COUNT(*) as cnt FROM "posts" WHERE "status" IS NULL`).all() as CountRow[];
		expect(Number(result[0].cnt)).toBe(0);
	});

	it('backfill with WHERE clause should fill only matching rows', async () => {
		createPostsTable();
		seedPosts();

		const helpers = createDataHelpers(db, 'sqlite');
		const affected = await helpers.backfill('posts', 'status', 'archived', {
			where: `"title" = 'Post A'`,
		});

		expect(affected).toBe(1);

		const row = sqliteDb.prepare(`SELECT "status" FROM "posts" WHERE "id" = '1'`).get() as Record<string, unknown>;
		expect(row['status']).toBe('archived');
	});

	it('transform should apply SQL expression', async () => {
		createPostsTable();
		sqliteDb.prepare(`INSERT INTO "posts" ("id", "title", "status") VALUES ('1', 'hello', 'draft'), ('2', 'world', 'draft')`).run();

		const helpers = createDataHelpers(db, 'sqlite');
		const affected = await helpers.transform('posts', 'title', `UPPER("title")`);

		expect(affected).toBe(2);

		const rows = sqliteDb.prepare(`SELECT "title" FROM "posts" ORDER BY "id"`).all() as Record<string, unknown>[];
		expect(rows[0]['title']).toBe('HELLO');
		expect(rows[1]['title']).toBe('WORLD');
	});

	it('copyData should copy rows between tables', async () => {
		sqliteDb.prepare(`CREATE TABLE "source" ("id" TEXT PRIMARY KEY, "name" TEXT, "value" INTEGER)`).run();
		sqliteDb.prepare(`CREATE TABLE "target" ("id" TEXT PRIMARY KEY, "label" TEXT, "amount" INTEGER)`).run();
		sqliteDb.prepare(`INSERT INTO "source" ("id", "name", "value") VALUES ('1', 'A', 10), ('2', 'B', 20)`).run();

		const helpers = createDataHelpers(db, 'sqlite');
		const affected = await helpers.copyData('source', 'target', {
			id: 'id',
			label: 'name',
			amount: 'value',
		});

		expect(affected).toBe(2);

		const rows = sqliteDb.prepare(`SELECT "label", "amount" FROM "target" ORDER BY "id"`).all() as Record<string, unknown>[];
		expect(rows[0]['label']).toBe('A');
		expect(rows[0]['amount']).toBe(10);
	});

	it('columnToJson and jsonToColumn should roundtrip', async () => {
		sqliteDb.prepare(`CREATE TABLE "settings" ("id" TEXT PRIMARY KEY, "theme" TEXT, "meta" TEXT DEFAULT '{}')`).run();
		sqliteDb.prepare(`INSERT INTO "settings" ("id", "theme") VALUES ('1', 'dark')`).run();

		const helpers = createDataHelpers(db, 'sqlite');

		// Column → JSON
		await helpers.columnToJson('settings', 'theme', 'meta', 'theme');

		const jsonRow = sqliteDb.prepare(`SELECT json_extract("meta", '$.theme') as theme_val FROM "settings" WHERE "id" = '1'`).get() as Record<string, unknown>;
		expect(jsonRow['theme_val']).toBe('dark');

		// JSON → Column
		await helpers.jsonToColumn('settings', 'meta', 'theme', 'extracted_theme', 'TEXT');

		const colRow = sqliteDb.prepare(`SELECT "extracted_theme" FROM "settings" WHERE "id" = '1'`).get() as Record<string, unknown>;
		expect(colRow['extracted_theme']).toBe('dark');
	});

	it('dedup should remove duplicate rows', async () => {
		sqliteDb.prepare(`CREATE TABLE "emails" ("id" TEXT PRIMARY KEY, "email" TEXT, "createdAt" TEXT NOT NULL DEFAULT (datetime('now')))`).run();
		sqliteDb.prepare(`INSERT INTO "emails" ("id", "email", "createdAt") VALUES ('1', 'a@test.com', '2026-01-01'), ('2', 'a@test.com', '2026-01-02'), ('3', 'b@test.com', '2026-01-01'), ('4', 'a@test.com', '2026-01-03')`).run();

		const helpers = createDataHelpers(db, 'sqlite');
		const removed = await helpers.dedup('emails', ['email'], 'first');

		expect(removed).toBe(2);

		const result = sqliteDb.prepare(`SELECT COUNT(*) as cnt FROM "emails"`).all() as CountRow[];
		expect(Number(result[0].cnt)).toBe(2);
	});
});
