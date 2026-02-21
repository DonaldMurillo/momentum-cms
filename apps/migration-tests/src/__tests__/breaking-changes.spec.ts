/* eslint-disable @typescript-eslint/no-empty-function */
/**
 * Integration tests: Breaking changes against real databases.
 *
 * THE WHOLE POINT OF THESE TESTS:
 * Seed tables with messy real-world data (NULLs, duplicates, orphaned FKs,
 * type mismatches), then attempt dangerous migrations. Verify that:
 *
 * 1. The danger detector flags operations BEFORE they run
 * 2. The clone-test-apply pipeline catches failures ON THE CLONE
 * 3. The real database is NEVER touched when things go wrong
 * 4. Useful fix suggestions are generated
 *
 * These tests simulate what happens when you run migrations against
 * your local dev DB that already has data — the exact scenario users
 * encounter before shipping code to production.
 */
import { Pool } from 'pg';
import Database from 'better-sqlite3';
import {
	runPush,
	cloneTestApply,
	introspectPostgres,
	introspectSqlite,
	detectDangers,
	diffSchemas,
	collectionsToSchema,
} from '@momentumcms/migrations';
import type {
	LoadedMigration,
	MigrationContext,
	CloneCapableDb,
	TableSnapshot,
} from '@momentumcms/migrations';
import { defineCollection, text, number, relationship } from '@momentumcms/core';
import { Client } from 'pg';
import {
	createTestPgDb,
	dropTestPgDb,
	createTestSqliteDb,
	dropTestSqliteDb,
	getDatabaseUrl,
} from '../helpers/test-db';
import {
	pgPushDb,
	pgQueryFn,
	pgTracker,
	pgDataDb,
	sqlitePushDb,
	sqliteQueryFn,
} from '../helpers/adapter-wiring';
import { isPgAvailable } from '../helpers/pg-availability';
import { createDataHelpers } from '@momentumcms/migrations';

const pgAvailable = await isPgAvailable();

/** Helper: find a table by name. */
function _findTable(tables: TableSnapshot[], name: string): TableSnapshot | undefined {
	return tables.find((t) => t.name === name);
}

// ============================================
// Collections for breaking-change scenarios
// ============================================

const PostsBefore = defineCollection({
	slug: 'posts',
	fields: [text('title', { required: true }), text('body'), text('status')],
});

// ADD a required field with no default → explodes on populated table
const PostsAddRequiredField = defineCollection({
	slug: 'posts',
	fields: [
		text('title', { required: true }),
		text('body'),
		text('status'),
		text('slug', { required: true }), // NOT NULL, no default
	],
});

// REMOVE a field → data loss
const PostsDropColumn = defineCollection({
	slug: 'posts',
	fields: [
		text('title', { required: true }),
		// 'body' removed → DROP COLUMN
		text('status'),
	],
});

// CHANGE nullable to required → fails if NULLs exist
const PostsMakeRequired = defineCollection({
	slug: 'posts',
	fields: [
		text('title', { required: true }),
		text('body', { required: true }), // was nullable, now required
		text('status'),
	],
});

// Change field type → lossy cast
const PostsChangeType = defineCollection({
	slug: 'posts',
	fields: [
		text('title', { required: true }),
		number('body'), // was TEXT, now NUMBER → cast fails on non-numeric data
		text('status'),
	],
});

// Remove entire collection → DROP TABLE
const NoPosts = defineCollection({
	slug: 'other-stuff',
	fields: [text('name')],
});

// Relationship collections for FK testing
const Authors = defineCollection({
	slug: 'authors',
	fields: [text('name', { required: true })],
});

const _Articles = defineCollection({
	slug: 'articles',
	fields: [
		text('title', { required: true }),
		relationship('author', { collection: () => Authors, required: true }),
	],
});

// ============================================
// PostgreSQL: Danger Detection (pre-execution)
// ============================================

describe.skipIf(!pgAvailable)('breaking-changes: danger detection (PostgreSQL)', () => {
	it('should flag ADD NOT NULL column without default as ERROR', () => {
		const desired = collectionsToSchema([PostsAddRequiredField], 'postgresql');
		const actual = collectionsToSchema([PostsBefore], 'postgresql');
		const diff = diffSchemas(desired, actual, 'postgresql');

		expect(diff.hasChanges).toBe(true);

		const dangers = detectDangers(diff.operations, 'postgresql');
		expect(dangers.hasErrors).toBe(true);

		const addColError = dangers.warnings.find(
			(w) => w.severity === 'error' && w.message.includes('slug'),
		);
		expect(addColError).toBeDefined();
		expect(addColError!.message).toContain('NOT NULL');
		expect(addColError!.message).toContain('without a default');
	});

	it('should flag DROP TABLE as ERROR', () => {
		const desired = collectionsToSchema([NoPosts], 'postgresql');
		const actual = collectionsToSchema([PostsBefore], 'postgresql');
		const diff = diffSchemas(desired, actual, 'postgresql');

		const dangers = detectDangers(diff.operations, 'postgresql');
		expect(dangers.hasErrors).toBe(true);

		const dropError = dangers.warnings.find(
			(w) => w.severity === 'error' && w.message.includes('Dropping table'),
		);
		expect(dropError).toBeDefined();
		expect(dropError!.message).toContain('posts');
	});

	it('should flag DROP COLUMN as WARNING', () => {
		const desired = collectionsToSchema([PostsDropColumn], 'postgresql');
		const actual = collectionsToSchema([PostsBefore], 'postgresql');
		const diff = diffSchemas(desired, actual, 'postgresql');

		const dangers = detectDangers(diff.operations, 'postgresql');
		expect(dangers.hasWarnings).toBe(true);

		const dropColWarning = dangers.warnings.find(
			(w) => w.severity === 'warning' && w.message.includes('Dropping column'),
		);
		expect(dropColWarning).toBeDefined();
		expect(dropColWarning!.message).toContain('body');
	});

	it('should flag SET NOT NULL as WARNING', () => {
		const desired = collectionsToSchema([PostsMakeRequired], 'postgresql');
		const actual = collectionsToSchema([PostsBefore], 'postgresql');
		const diff = diffSchemas(desired, actual, 'postgresql');

		const dangers = detectDangers(diff.operations, 'postgresql');
		const notNullWarning = dangers.warnings.find(
			(w) => w.severity === 'warning' && w.message.includes('NOT NULL'),
		);
		expect(notNullWarning).toBeDefined();
		expect(notNullWarning!.suggestion).toContain('backfill');
	});

	it('should flag lossy type change as WARNING', () => {
		const desired = collectionsToSchema([PostsChangeType], 'postgresql');
		const actual = collectionsToSchema([PostsBefore], 'postgresql');
		const diff = diffSchemas(desired, actual, 'postgresql');

		const dangers = detectDangers(diff.operations, 'postgresql');
		const typeWarning = dangers.warnings.find(
			(w) => w.message.includes('data loss') || w.message.includes('cast'),
		);
		expect(typeWarning).toBeDefined();
	});

	it('should BLOCK push when danger detection finds errors', async () => {
		const { dbName, connectionString } = await createTestPgDb();
		const pool = new Pool({ connectionString, max: 5 });

		try {
			// First push to create the table
			await runPush({
				collections: [PostsBefore],
				dialect: 'postgresql',
				db: pgPushDb(pool),
				introspect: () => introspectPostgres(pgQueryFn(pool)),
				skipDangerDetection: true,
			});

			// Insert data
			await pool.query(
				`INSERT INTO "posts" ("id", "title", "body", "status", "createdAt", "updatedAt") VALUES ('1', 'Hello', 'World', 'draft', NOW(), NOW())`,
			);

			// Now try to push a breaking change WITH danger detection enabled
			const result = await runPush({
				collections: [PostsAddRequiredField],
				dialect: 'postgresql',
				db: pgPushDb(pool),
				introspect: () => introspectPostgres(pgQueryFn(pool)),
				// skipDangerDetection: false (default)
			});

			// Should be blocked
			expect(result.applied).toBe(false);
			expect(result.dangers).not.toBeNull();
			expect(result.dangers!.hasErrors).toBe(true);
			expect(result.sqlStatements).toHaveLength(0);

			// Table should still be intact
			const rows = await pool.query(`SELECT COUNT(*) as cnt FROM "posts"`);
			expect(Number(rows.rows[0].cnt)).toBe(1);
		} finally {
			await pool.end();
			await dropTestPgDb(dbName);
		}
	});
});

// ============================================
// PostgreSQL: Real SQL failures on clone
// ============================================

describe.skipIf(!pgAvailable)('breaking-changes: clone catches real failures (PostgreSQL)', () => {
	let pool: Pool;
	let dbName: string;
	let connectionString: string;
	const clonePools: Pool[] = [];

	beforeEach(async () => {
		const result = await createTestPgDb();
		dbName = result.dbName;
		connectionString = result.connectionString;
		pool = new Pool({ connectionString, max: 5 });
		pool.on('error', () => {});
	});

	afterEach(async () => {
		for (const p of clonePools) {
			await p.end().catch(() => {});
		}
		clonePools.length = 0;
		await pool.end().catch(() => {});
		await dropTestPgDb(dbName);
	});

	function createCloneDb(): CloneCapableDb {
		const adminUrl = getDatabaseUrl('postgres');
		return {
			async cloneDatabase(targetName: string): Promise<string> {
				const client = new Client({ connectionString: adminUrl });
				await client.connect();
				try {
					await client.query(
						`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
						[dbName],
					);
					await client.query(`CREATE DATABASE "${targetName}" TEMPLATE "${dbName}"`);
				} finally {
					await client.end();
				}
				return targetName;
			},
			async dropClone(targetName: string): Promise<void> {
				const client = new Client({ connectionString: adminUrl });
				await client.connect();
				try {
					await client.query(
						`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
						[targetName],
					);
					await client.query(`DROP DATABASE IF EXISTS "${targetName}" WITH (FORCE)`);
				} finally {
					await client.end();
				}
			},
		};
	}

	function buildCloneTracker(cloneName: string): ReturnType<typeof pgTracker> {
		const clonePool = new Pool({ connectionString: getDatabaseUrl(cloneName), max: 3 });
		clonePool.on('error', () => {});
		clonePools.push(clonePool);
		return pgTracker(clonePool);
	}

	function buildCloneContext(cloneName: string): MigrationContext {
		const clonePool = new Pool({ connectionString: getDatabaseUrl(cloneName), max: 3 });
		clonePool.on('error', () => {});
		clonePools.push(clonePool);
		const dataDb = pgDataDb(clonePool);
		const helpers = createDataHelpers(dataDb, 'postgresql');
		return {
			async sql(query: string, params?: unknown[]): Promise<void> {
				await clonePool.query(query, params);
			},
			async query<T extends Record<string, unknown>>(
				sql: string,
				params?: unknown[],
			): Promise<T[]> {
				const result = await clonePool.query(sql, params);
				return result.rows as T[];
			},
			data: helpers,
			dialect: 'postgresql',
			log: { info: (): void => {}, warn: (): void => {} },
		};
	}

	function refreshPool(): void {
		pool = new Pool({ connectionString, max: 5 });
		pool.on('error', () => {});
	}

	async function seedPostsTable(): Promise<void> {
		await pool.query(`
			CREATE TABLE "posts" (
				"id" VARCHAR(36) PRIMARY KEY,
				"title" VARCHAR(255) NOT NULL,
				"body" TEXT,
				"status" TEXT,
				"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`);
		await pool.query(`
			INSERT INTO "posts" ("id", "title", "body", "status") VALUES
			('1', 'First Post', 'Hello world', 'published'),
			('2', 'Draft Post', NULL, NULL),
			('3', 'Another', 'Some text', 'draft'),
			('4', 'Empty Status', 'Content here', NULL),
			('5', 'No Body', NULL, 'published')
		`);
	}

	it('ADD NOT NULL column without default → fails on clone, real DB untouched', async () => {
		await seedPostsTable();

		const migration: LoadedMigration = {
			name: 'add_slug_not_null',
			file: {
				meta: { name: 'add_slug_not_null', description: 'Add required slug column' },
				async up(ctx: MigrationContext): Promise<void> {
					await ctx.sql(`ALTER TABLE "posts" ADD COLUMN "slug" VARCHAR(255) NOT NULL`);
				},
				async down(ctx: MigrationContext): Promise<void> {
					await ctx.sql(`ALTER TABLE "posts" DROP COLUMN "slug"`);
				},
			},
		};

		const result = await cloneTestApply({
			migrations: [migration],
			dialect: 'postgresql',
			tracker: pgTracker(pool),
			buildContext: () => ({
				async sql(q: string, p?: unknown[]): Promise<void> {
					await pool.query(q, p);
				},
				async query<T extends Record<string, unknown>>(s: string, p?: unknown[]): Promise<T[]> {
					return (await pool.query(s, p)).rows as T[];
				},
				data: createDataHelpers(pgDataDb(pool), 'postgresql'),
				dialect: 'postgresql',
				log: { info: (): void => {}, warn: (): void => {} },
			}),
			db: createCloneDb(),
			buildCloneTracker,
			buildCloneContext,
			skipDangerDetection: true,
		});

		expect(result.phase).toBe('test');
		expect(result.error).toContain('Migration failed on clone');
		expect(result.applyResult).toBeNull();

		// Real DB: column should NOT exist, all 5 rows intact
		refreshPool();
		const cols = await pool.query(
			`SELECT column_name FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'slug'`,
		);
		expect(cols.rows).toHaveLength(0);

		const rows = await pool.query(`SELECT COUNT(*) as cnt FROM "posts"`);
		expect(Number(rows.rows[0].cnt)).toBe(5);
	});

	it('SET NOT NULL on column with existing NULLs → fails on clone, real DB untouched', async () => {
		await seedPostsTable();

		const migration: LoadedMigration = {
			name: 'make_body_required',
			file: {
				meta: { name: 'make_body_required', description: 'Make body NOT NULL' },
				async up(ctx: MigrationContext): Promise<void> {
					await ctx.sql(`ALTER TABLE "posts" ALTER COLUMN "body" SET NOT NULL`);
				},
				async down(ctx: MigrationContext): Promise<void> {
					await ctx.sql(`ALTER TABLE "posts" ALTER COLUMN "body" DROP NOT NULL`);
				},
			},
		};

		const result = await cloneTestApply({
			migrations: [migration],
			dialect: 'postgresql',
			tracker: pgTracker(pool),
			buildContext: () => ({
				async sql(q: string, p?: unknown[]): Promise<void> {
					await pool.query(q, p);
				},
				async query<T extends Record<string, unknown>>(s: string, p?: unknown[]): Promise<T[]> {
					return (await pool.query(s, p)).rows as T[];
				},
				data: createDataHelpers(pgDataDb(pool), 'postgresql'),
				dialect: 'postgresql',
				log: { info: (): void => {}, warn: (): void => {} },
			}),
			db: createCloneDb(),
			buildCloneTracker,
			buildCloneContext,
			skipDangerDetection: true,
		});

		expect(result.phase).toBe('test');
		expect(result.error).toContain('Migration failed on clone');

		// Real DB: body should still be nullable
		refreshPool();
		const col = await pool.query(
			`SELECT is_nullable FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'body'`,
		);
		expect(col.rows[0].is_nullable).toBe('YES');
	});

	it('ADD UNIQUE INDEX when duplicates exist → fails on clone, real DB untouched', async () => {
		await pool.query(`
			CREATE TABLE "users" (
				"id" VARCHAR(36) PRIMARY KEY,
				"email" VARCHAR(255),
				"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`);
		// Insert duplicates
		await pool.query(`
			INSERT INTO "users" ("id", "email") VALUES
			('1', 'alice@test.com'),
			('2', 'alice@test.com'),
			('3', 'bob@test.com')
		`);

		const migration: LoadedMigration = {
			name: 'add_unique_email',
			file: {
				meta: { name: 'add_unique_email', description: 'Unique email constraint' },
				async up(ctx: MigrationContext): Promise<void> {
					await ctx.sql(`CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email")`);
				},
				async down(ctx: MigrationContext): Promise<void> {
					await ctx.sql(`DROP INDEX IF EXISTS "users_email_unique"`);
				},
			},
		};

		const result = await cloneTestApply({
			migrations: [migration],
			dialect: 'postgresql',
			tracker: pgTracker(pool),
			buildContext: () => ({
				async sql(q: string, p?: unknown[]): Promise<void> {
					await pool.query(q, p);
				},
				async query<T extends Record<string, unknown>>(s: string, p?: unknown[]): Promise<T[]> {
					return (await pool.query(s, p)).rows as T[];
				},
				data: createDataHelpers(pgDataDb(pool), 'postgresql'),
				dialect: 'postgresql',
				log: { info: (): void => {}, warn: (): void => {} },
			}),
			db: createCloneDb(),
			buildCloneTracker,
			buildCloneContext,
			skipDangerDetection: true,
		});

		expect(result.phase).toBe('test');
		expect(result.error).toContain('Migration failed on clone');

		// Suggestions should mention dedup
		expect(result.suggestions.length).toBeGreaterThan(0);
		expect(result.suggestions[0]).toContain('dedup');

		// Real DB: all 3 rows still there, no index
		refreshPool();
		const rows = await pool.query(`SELECT COUNT(*) as cnt FROM "users"`);
		expect(Number(rows.rows[0].cnt)).toBe(3);
	});

	it('ADD FK when orphaned rows exist → fails on clone, real DB untouched', async () => {
		await pool.query(`
			CREATE TABLE "authors" (
				"id" VARCHAR(36) PRIMARY KEY,
				"name" TEXT NOT NULL,
				"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`);
		await pool.query(`
			CREATE TABLE "articles" (
				"id" VARCHAR(36) PRIMARY KEY,
				"title" TEXT NOT NULL,
				"author" VARCHAR(36),
				"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`);
		// Insert orphaned rows (author IDs that don't exist)
		await pool.query(`INSERT INTO "authors" ("id", "name") VALUES ('a1', 'Alice')`);
		await pool.query(`
			INSERT INTO "articles" ("id", "title", "author") VALUES
			('1', 'Valid article', 'a1'),
			('2', 'Orphaned article', 'nonexistent_author'),
			('3', 'Another orphan', 'also_missing')
		`);

		const migration: LoadedMigration = {
			name: 'add_fk_author',
			file: {
				meta: { name: 'add_fk_author', description: 'Add FK to authors' },
				async up(ctx: MigrationContext): Promise<void> {
					await ctx.sql(
						`ALTER TABLE "articles" ADD CONSTRAINT "fk_articles_author" FOREIGN KEY ("author") REFERENCES "authors"("id") ON DELETE SET NULL`,
					);
				},
				async down(ctx: MigrationContext): Promise<void> {
					await ctx.sql(`ALTER TABLE "articles" DROP CONSTRAINT "fk_articles_author"`);
				},
			},
		};

		const result = await cloneTestApply({
			migrations: [migration],
			dialect: 'postgresql',
			tracker: pgTracker(pool),
			buildContext: () => ({
				async sql(q: string, p?: unknown[]): Promise<void> {
					await pool.query(q, p);
				},
				async query<T extends Record<string, unknown>>(s: string, p?: unknown[]): Promise<T[]> {
					return (await pool.query(s, p)).rows as T[];
				},
				data: createDataHelpers(pgDataDb(pool), 'postgresql'),
				dialect: 'postgresql',
				log: { info: (): void => {}, warn: (): void => {} },
			}),
			db: createCloneDb(),
			buildCloneTracker,
			buildCloneContext,
			skipDangerDetection: true,
		});

		expect(result.phase).toBe('test');
		expect(result.error).toContain('Migration failed on clone');

		// Suggestions should mention foreign key
		expect(result.suggestions.length).toBeGreaterThan(0);
		expect(result.suggestions[0]).toContain('Foreign key');

		// Real DB: no constraint added, all rows intact
		refreshPool();
		const articles = await pool.query(`SELECT COUNT(*) as cnt FROM "articles"`);
		expect(Number(articles.rows[0].cnt)).toBe(3);
	});

	it('TYPE CAST TEXT → INTEGER with non-numeric data → fails on clone, real DB untouched', async () => {
		await pool.query(`
			CREATE TABLE "metrics" (
				"id" VARCHAR(36) PRIMARY KEY,
				"value" TEXT,
				"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`);
		await pool.query(`
			INSERT INTO "metrics" ("id", "value") VALUES
			('1', '42'),
			('2', 'not a number'),
			('3', '100')
		`);

		const migration: LoadedMigration = {
			name: 'change_value_to_int',
			file: {
				meta: { name: 'change_value_to_int', description: 'Cast value to integer' },
				async up(ctx: MigrationContext): Promise<void> {
					await ctx.sql(
						`ALTER TABLE "metrics" ALTER COLUMN "value" TYPE INTEGER USING "value"::INTEGER`,
					);
				},
				async down(ctx: MigrationContext): Promise<void> {
					await ctx.sql(`ALTER TABLE "metrics" ALTER COLUMN "value" TYPE TEXT`);
				},
			},
		};

		const result = await cloneTestApply({
			migrations: [migration],
			dialect: 'postgresql',
			tracker: pgTracker(pool),
			buildContext: () => ({
				async sql(q: string, p?: unknown[]): Promise<void> {
					await pool.query(q, p);
				},
				async query<T extends Record<string, unknown>>(s: string, p?: unknown[]): Promise<T[]> {
					return (await pool.query(s, p)).rows as T[];
				},
				data: createDataHelpers(pgDataDb(pool), 'postgresql'),
				dialect: 'postgresql',
				log: { info: (): void => {}, warn: (): void => {} },
			}),
			db: createCloneDb(),
			buildCloneTracker,
			buildCloneContext,
			skipDangerDetection: true,
		});

		expect(result.phase).toBe('test');
		expect(result.error).toContain('Migration failed on clone');

		// Real DB: column should still be TEXT, data intact
		refreshPool();
		const col = await pool.query(
			`SELECT data_type FROM information_schema.columns WHERE table_name = 'metrics' AND column_name = 'value'`,
		);
		expect(col.rows[0].data_type).toBe('text');

		const rows = await pool.query(`SELECT "value" FROM "metrics" WHERE "id" = '2'`);
		expect(rows.rows[0].value).toBe('not a number');
	});

	it('full pipeline: messy data → clone catches → suggestions → real DB pristine', async () => {
		// Seed a realistic messy database
		await pool.query(`
			CREATE TABLE "products" (
				"id" VARCHAR(36) PRIMARY KEY,
				"name" VARCHAR(255) NOT NULL,
				"price" TEXT,
				"category" TEXT,
				"sku" TEXT,
				"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`);
		await pool.query(`
			INSERT INTO "products" ("id", "name", "price", "category", "sku") VALUES
			('1', 'Widget A', '19.99', 'electronics', 'SKU-001'),
			('2', 'Widget B', 'free', NULL, 'SKU-001'),
			('3', 'Widget C', '5.00', 'electronics', NULL),
			('4', 'Widget D', NULL, NULL, 'SKU-002'),
			('5', 'Widget E', 'call for pricing', 'home', 'SKU-003')
		`);

		// Now attempt a migration that does ALL the dangerous things:
		// 1. Cast price TEXT → NUMERIC (fails: 'free', 'call for pricing')
		const migrations: LoadedMigration[] = [
			{
				name: 'cast_price_to_numeric',
				file: {
					meta: { name: 'cast_price_to_numeric', description: 'Convert price to numeric' },
					async up(ctx: MigrationContext): Promise<void> {
						await ctx.sql(
							`ALTER TABLE "products" ALTER COLUMN "price" TYPE NUMERIC USING "price"::NUMERIC`,
						);
					},
					async down(ctx: MigrationContext): Promise<void> {
						await ctx.sql(`ALTER TABLE "products" ALTER COLUMN "price" TYPE TEXT`);
					},
				},
			},
		];

		const result = await cloneTestApply({
			migrations,
			dialect: 'postgresql',
			tracker: pgTracker(pool),
			buildContext: () => ({
				async sql(q: string, p?: unknown[]): Promise<void> {
					await pool.query(q, p);
				},
				async query<T extends Record<string, unknown>>(s: string, p?: unknown[]): Promise<T[]> {
					return (await pool.query(s, p)).rows as T[];
				},
				data: createDataHelpers(pgDataDb(pool), 'postgresql'),
				dialect: 'postgresql',
				log: { info: (): void => {}, warn: (): void => {} },
			}),
			db: createCloneDb(),
			buildCloneTracker,
			buildCloneContext,
			skipDangerDetection: true,
		});

		// Clone caught the failure
		expect(result.phase).toBe('test');
		expect(result.error).toBeDefined();
		expect(result.applyResult).toBeNull();
		expect(result.cloneCleanedUp).toBe(true);

		// Real DB: completely untouched
		refreshPool();
		const priceCol = await pool.query(
			`SELECT data_type FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'price'`,
		);
		expect(priceCol.rows[0].data_type).toBe('text');

		const freeRow = await pool.query(`SELECT "price" FROM "products" WHERE "id" = '2'`);
		expect(freeRow.rows[0].price).toBe('free');

		const allRows = await pool.query(`SELECT COUNT(*) as cnt FROM "products"`);
		expect(Number(allRows.rows[0].cnt)).toBe(5);
	});
});

// ============================================
// SQLite: Breaking changes
// ============================================

describe('breaking-changes: SQLite limitations', () => {
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

	it('should generate comment for ALTER COLUMN TYPE (SQLite limitation)', async () => {
		// Push initial schema
		await runPush({
			collections: [PostsBefore],
			dialect: 'sqlite',
			db: sqlitePushDb(db),
			introspect: () => introspectSqlite(sqliteQueryFn(db)),
			skipDangerDetection: true,
		});

		// Now try to change field type
		const result = await runPush({
			collections: [PostsChangeType],
			dialect: 'sqlite',
			db: sqlitePushDb(db),
			introspect: () => introspectSqlite(sqliteQueryFn(db)),
			skipDangerDetection: true,
		});

		// SQLite generates comments instead of ALTER statements
		const commentStmts = result.sqlStatements.filter((s) => s.startsWith('--'));
		expect(commentStmts.length).toBeGreaterThan(0);
		expect(commentStmts.some((s) => s.includes('Cannot alter column type'))).toBe(true);
	});

	it('should detect ALTER COLUMN TYPE as ERROR in danger detection for SQLite', () => {
		const desired = collectionsToSchema([PostsChangeType], 'sqlite');
		const actual = collectionsToSchema([PostsBefore], 'sqlite');
		const diff = diffSchemas(desired, actual, 'sqlite');

		const dangers = detectDangers(diff.operations, 'sqlite');
		expect(dangers.hasErrors).toBe(true);

		const typeError = dangers.warnings.find(
			(w) => w.severity === 'error' && w.message.includes('does not support ALTER COLUMN TYPE'),
		);
		expect(typeError).toBeDefined();
	});

	it('should flag DROP TABLE as ERROR for SQLite too', () => {
		const desired = collectionsToSchema([NoPosts], 'sqlite');
		const actual = collectionsToSchema([PostsBefore], 'sqlite');
		const diff = diffSchemas(desired, actual, 'sqlite');

		const dangers = detectDangers(diff.operations, 'sqlite');
		expect(dangers.hasErrors).toBe(true);

		const dropError = dangers.warnings.find(
			(w) => w.severity === 'error' && w.message.includes('Dropping table'),
		);
		expect(dropError).toBeDefined();
	});
});
