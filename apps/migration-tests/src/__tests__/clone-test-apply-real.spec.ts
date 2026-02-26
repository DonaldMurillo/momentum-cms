/**
 * Integration tests: Clone-Test-Apply pipeline against real PostgreSQL.
 *
 * Uses CREATE DATABASE ... TEMPLATE for real cloning, runs migrations
 * on the clone, then applies to the real database.
 *
 * PG only — SQLite doesn't support database cloning.
 *
 * NOTE: CREATE DATABASE ... TEMPLATE requires terminating all connections
 * to the source DB. Tests use a pool-recreation pattern: end pool before
 * clone, create fresh pool after clone for the apply phase.
 */
import { Pool, Client } from 'pg';
import { cloneTestApply } from '@momentumcms/migrations';
import type { LoadedMigration, MigrationContext, CloneCapableDb } from '@momentumcms/migrations';
import { createTestPgDb, dropTestPgDb, getDatabaseUrl } from '../helpers/test-db';
import { pgTracker, pgDataDb } from '../helpers/adapter-wiring';
import { isPgAvailable } from '../helpers/pg-availability';
import { createDataHelpers } from '@momentumcms/migrations';

const pgAvailable = await isPgAvailable();

// ============================================
// Migration factories
// ============================================

function createTableMigration(tableName: string): LoadedMigration {
	return {
		name: `create_${tableName}`,
		file: {
			meta: { name: `create_${tableName}`, description: `Create ${tableName} table` },
			async up(ctx: MigrationContext): Promise<void> {
				await ctx.sql(
					`CREATE TABLE "${tableName}" ("id" VARCHAR(36) PRIMARY KEY, "title" VARCHAR(255) NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
				);
			},
			async down(ctx: MigrationContext): Promise<void> {
				await ctx.sql(`DROP TABLE IF EXISTS "${tableName}"`);
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
				throw new Error('Intentional clone test failure');
			},
			async down(): Promise<void> {
				/* noop */
			},
		},
	};
}

/** Check if a database exists by attempting a connection. */
async function pgDbExists(dbName: string): Promise<boolean> {
	const client = new Client({ connectionString: getDatabaseUrl(dbName) });
	try {
		await client.connect();
		await client.query('SELECT 1');
		return true;
	} catch {
		return false;
	} finally {
		try {
			await client.end();
		} catch {
			// Client may already be closed
		}
	}
}

/**
 * Create a CloneCapableDb that properly manages pool lifecycle.
 *
 * Before cloning, the caller's pool MUST be ended so there are no
 * active connections to the source DB. After cloning, the caller
 * should create a new pool.
 */
function createCloneDb(sourceDb: string): CloneCapableDb {
	const adminUrl = getDatabaseUrl('postgres');

	return {
		async cloneDatabase(targetName: string): Promise<string> {
			const client = new Client({ connectionString: adminUrl });
			await client.connect();
			try {
				// Terminate any remaining connections
				await client.query(
					`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
					[sourceDb],
				);
				await client.query(`CREATE DATABASE "${targetName}" TEMPLATE "${sourceDb}"`);
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

/** Build a MigrationContext from a pool. */
function buildContextFromPool(pool: Pool): MigrationContext {
	const dataDb = pgDataDb(pool);
	const helpers = createDataHelpers(dataDb, 'postgresql');
	return {
		async sql(query: string, params?: unknown[]): Promise<void> {
			await pool.query(query, params);
		},
		async query<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
			const result = await pool.query(sql, params);
			return result.rows as T[];
		},
		data: helpers,
		dialect: 'postgresql',
		log: {
			info(): void {
				/* noop */
			},
			warn(): void {
				/* noop */
			},
		},
	};
}

// Pools for clone databases that need cleanup
const clonePools: Pool[] = [];

// ============================================
// Tests
// ============================================

describe.skipIf(!pgAvailable)('clone-test-apply-real (PostgreSQL)', () => {
	let pool: Pool;
	let dbName: string;
	let connectionString: string;

	beforeEach(async () => {
		const result = await createTestPgDb();
		dbName = result.dbName;
		connectionString = result.connectionString;
		pool = new Pool({ connectionString, max: 5 });
		// Suppress uncaught errors from terminated connections
		pool.on('error', () => {
			/* noop */
		});
	});

	afterEach(async () => {
		// End all clone pools
		for (const p of clonePools) {
			try {
				await p.end();
			} catch {
				// Pool may already be closed
			}
		}
		clonePools.length = 0;

		try {
			await pool.end();
		} catch {
			// Pool may already be closed
		}
		await dropTestPgDb(dbName);
	});

	function buildCloneTracker(cloneName: string): ReturnType<typeof pgTracker> {
		const clonePool = new Pool({ connectionString: getDatabaseUrl(cloneName), max: 3 });
		clonePool.on('error', () => {
			/* noop */
		});
		clonePools.push(clonePool);
		return pgTracker(clonePool);
	}

	function buildCloneContext(cloneName: string): MigrationContext {
		const clonePool = new Pool({ connectionString: getDatabaseUrl(cloneName), max: 3 });
		clonePool.on('error', () => {
			/* noop */
		});
		clonePools.push(clonePool);
		return buildContextFromPool(clonePool);
	}

	/** Recreate the main pool (after clone terminates connections). */
	function refreshPool(): void {
		pool = new Pool({ connectionString, max: 5 });
		pool.on('error', () => {
			/* noop */
		});
	}

	it('should complete full pipeline: clone, test, apply', async () => {
		const tracker = pgTracker(pool);
		const result = await cloneTestApply({
			migrations: [createTableMigration('cta_posts')],
			dialect: 'postgresql',
			tracker,
			buildContext: () => buildContextFromPool(pool),
			db: createCloneDb(dbName),
			buildCloneTracker,
			buildCloneContext,
			skipDangerDetection: true,
		});

		expect(result.phase).toBe('complete');
		expect(result.cloneResult).not.toBeNull();
		expect(result.cloneResult?.successCount).toBe(1);
		expect(result.applyResult).not.toBeNull();
		expect(result.applyResult?.successCount).toBe(1);
		expect(result.error).toBeUndefined();

		// Verify table exists in real DB (use fresh connection)
		refreshPool();
		const tables = await pool.query(
			`SELECT table_name FROM information_schema.tables WHERE table_name = 'cta_posts'`,
		);
		expect(tables.rows).toHaveLength(1);
	});

	it('should clean up clone database after pipeline', async () => {
		const tracker = pgTracker(pool);
		const result = await cloneTestApply({
			migrations: [createTableMigration('cta_posts')],
			dialect: 'postgresql',
			tracker,
			buildContext: () => buildContextFromPool(pool),
			db: createCloneDb(dbName),
			buildCloneTracker,
			buildCloneContext,
			skipDangerDetection: true,
		});

		expect(result.cloneCleanedUp).toBe(true);

		// Clone database should not exist
		const exists = await pgDbExists(result.cloneName);
		expect(exists).toBe(false);
	});

	it('should not touch real DB when clone test fails', async () => {
		const tracker = pgTracker(pool);
		const result = await cloneTestApply({
			migrations: [createTableMigration('cta_posts'), failingMigration('bad_migration')],
			dialect: 'postgresql',
			tracker,
			buildContext: () => buildContextFromPool(pool),
			db: createCloneDb(dbName),
			buildCloneTracker,
			buildCloneContext,
			skipDangerDetection: true,
		});

		expect(result.phase).toBe('test');
		expect(result.error).toContain('Migration failed on clone');
		expect(result.applyResult).toBeNull();
		expect(result.cloneCleanedUp).toBe(true);

		// Real DB should NOT have the table
		refreshPool();
		const tables = await pool.query(
			`SELECT table_name FROM information_schema.tables WHERE table_name = 'cta_posts'`,
		);
		expect(tables.rows).toHaveLength(0);
	});

	it('should keep source data intact after clone operations', async () => {
		// Pre-populate source with a table and data
		await pool.query(`CREATE TABLE "existing" ("id" VARCHAR(36) PRIMARY KEY, "value" TEXT)`);
		await pool.query(`INSERT INTO "existing" ("id", "value") VALUES ('1', 'original')`);

		const tracker = pgTracker(pool);
		const result = await cloneTestApply({
			migrations: [createTableMigration('cta_new')],
			dialect: 'postgresql',
			tracker,
			buildContext: () => buildContextFromPool(pool),
			db: createCloneDb(dbName),
			buildCloneTracker,
			buildCloneContext,
			skipDangerDetection: true,
		});

		expect(result.phase).toBe('complete');

		// Source data should be untouched
		refreshPool();
		const data = await pool.query(`SELECT "value" FROM "existing" WHERE "id" = '1'`);
		expect(data.rows[0].value).toBe('original');
	});

	it('should not apply to real DB in testOnly mode', async () => {
		const tracker = pgTracker(pool);
		const result = await cloneTestApply({
			migrations: [createTableMigration('cta_posts')],
			dialect: 'postgresql',
			tracker,
			buildContext: () => buildContextFromPool(pool),
			db: createCloneDb(dbName),
			buildCloneTracker,
			buildCloneContext,
			testOnly: true,
			skipDangerDetection: true,
		});

		expect(result.phase).toBe('skipped');
		expect(result.cloneResult).not.toBeNull();
		expect(result.cloneResult?.successCount).toBe(1);
		expect(result.applyResult).toBeNull();
		expect(result.cloneCleanedUp).toBe(true);

		// Real DB should NOT have the table
		refreshPool();
		const tables = await pool.query(
			`SELECT table_name FROM information_schema.tables WHERE table_name = 'cta_posts'`,
		);
		expect(tables.rows).toHaveLength(0);
	});

	it('should clone database with existing data', async () => {
		// Create table and insert data before cloning
		await pool.query(`CREATE TABLE "source_data" ("id" VARCHAR(36) PRIMARY KEY, "name" TEXT)`);
		await pool.query(
			`INSERT INTO "source_data" ("id", "name") VALUES ('1', 'Alice'), ('2', 'Bob')`,
		);

		let cloneHadData = false;
		const checkCloneMigration: LoadedMigration = {
			name: 'check_clone_data',
			file: {
				meta: { name: 'check_clone_data', description: 'Verify clone has source data' },
				async up(ctx: MigrationContext): Promise<void> {
					const rows = await ctx.query<{ cnt: string }>(
						`SELECT COUNT(*) as cnt FROM "source_data"`,
					);
					cloneHadData = Number(rows[0].cnt) === 2;
				},
				async down(): Promise<void> {
					/* noop */
				},
			},
		};

		const tracker = pgTracker(pool);
		const result = await cloneTestApply({
			migrations: [checkCloneMigration],
			dialect: 'postgresql',
			tracker,
			buildContext: () => buildContextFromPool(pool),
			db: createCloneDb(dbName),
			buildCloneTracker,
			buildCloneContext,
			skipDangerDetection: true,
		});

		expect(result.phase).toBe('complete');
		expect(cloneHadData).toBe(true);
	});

	it('should generate fix suggestions on clone failure', async () => {
		const notNullMigration: LoadedMigration = {
			name: 'add_not_null',
			file: {
				meta: { name: 'add_not_null', description: 'Fails with NOT NULL violation' },
				async up(): Promise<void> {
					throw new Error('column "status" of relation "posts" contains null values (NOT NULL)');
				},
				async down(): Promise<void> {
					/* noop */
				},
			},
		};

		const tracker = pgTracker(pool);
		const result = await cloneTestApply({
			migrations: [notNullMigration],
			dialect: 'postgresql',
			tracker,
			buildContext: () => buildContextFromPool(pool),
			db: createCloneDb(dbName),
			buildCloneTracker,
			buildCloneContext,
			skipDangerDetection: true,
		});

		expect(result.phase).toBe('test');
		expect(result.suggestions.length).toBeGreaterThan(0);
		expect(result.suggestions[0]).toContain('backfill');
	});
});
