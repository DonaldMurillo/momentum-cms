/**
 * Error-path integration tests for the Payload-style migration workflow.
 *
 * Exercises what happens when migrations hit real errors against populated databases.
 * PG only — clone-test-apply requires PostgreSQL.
 *
 * Seeds messy data (NULLs, duplicates, orphaned FKs), generates migrations,
 * and verifies the clone-test-apply pipeline catches failures safely.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Pool } from 'pg';
import { defineCollection, text, number } from '@momentumcms/core';
import {
	collectionsToSchema,
	diffSchemas,
	generateMigrationFileContent,
	generateMigrationName,
	readSnapshot,
	writeSnapshot,
	loadMigrationsFromDisk,
	runMigrations,
	cloneTestApply,
	detectDangers,
	createSchemaSnapshot,
} from '@momentumcms/migrations';
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
	pgTracker,
	buildPgContext,
	pgCloneDb,
	pgPoolForDb,
} from '../../../migration-tests/src/helpers/adapter-wiring';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { isPgAvailable } from '../../../migration-tests/src/helpers/pg-availability';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { createTestPgDb, dropTestPgDb } from '../../../migration-tests/src/helpers/test-db';

// ============================================
// Test collections
// ============================================

const ItemsV1 = defineCollection({
	slug: 'items',
	fields: [text('title', { required: true }), text('description'), number('quantity')],
});

/** V2: adds a required field without default — will fail if table has existing rows */
const ItemsV2Required = defineCollection({
	slug: 'items',
	fields: [
		text('title', { required: true }),
		text('description'),
		number('quantity'),
		text('sku', { required: true }),
	],
});

/** V2: adds a nullable field — always safe */
const ItemsV2Safe = defineCollection({
	slug: 'items',
	fields: [
		text('title', { required: true }),
		text('description'),
		number('quantity'),
		text('sku'),
	],
});

/** V2: drops the items table entirely */
const NoItems = defineCollection({
	slug: 'other-table',
	fields: [text('name')],
});

// ============================================
// Helper: generate and write migration file
// ============================================

function generateAndWriteMigration(
	migrationDir: string,
	collections: Parameters<typeof collectionsToSchema>[0],
	previous: ReturnType<typeof createSchemaSnapshot>,
	migrationName: string,
	dialect: 'postgresql' = 'postgresql',
): { name: string; diff: ReturnType<typeof diffSchemas> } {
	const desired = collectionsToSchema(collections, dialect);
	const diff = diffSchemas(desired, previous, dialect);
	const name = generateMigrationName(migrationName);
	writeFileSync(
		join(migrationDir, `${name}.ts`),
		generateMigrationFileContent(diff, { name, dialect }),
		'utf-8',
	);
	writeSnapshot(migrationDir, desired);
	return { name, diff };
}

// ============================================
// Tests
// ============================================

describe('breaking-generate-run (PostgreSQL)', () => {
	let pool: Pool;
	let dbName: string;
	let connectionString: string;
	let migrationDir: string;
	/** Track clone pools so we can end them before dropping databases */
	let clonePools: Pool[];

	beforeAll(async () => {
		if (!(await isPgAvailable())) return;
	});

	beforeEach(async () => {
		if (!(await isPgAvailable())) return;
		clonePools = [];

		const testDb = await createTestPgDb();
		dbName = testDb.dbName;
		connectionString = testDb.connectionString;
		pool = new Pool({ connectionString, max: 5 });
		// Suppress expected "terminating connection" errors from pg_terminate_backend during cloning
		pool.on('error', () => { /* noop */ });

		migrationDir = join(
			tmpdir(),
			`mig-errors-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		mkdirSync(migrationDir, { recursive: true });
	});

	afterEach(async () => {
		// End clone pools first to avoid "terminating connection" errors
		for (const p of clonePools ?? []) {
			try { await p.end(); } catch { /* pool may already be dead */ }
		}
		if (pool) await pool.end();
		if (dbName) await dropTestPgDb(dbName);
		if (migrationDir && existsSync(migrationDir)) {
			rmSync(migrationDir, { recursive: true, force: true });
		}
	});

	/**
	 * Create a pool for a clone database, tracking it for cleanup.
	 */
	function trackedPoolForDb(name: string): Pool {
		const p = pgPoolForDb(name);
		// Suppress expected "terminating connection" errors during clone cleanup
		p.on('error', () => { /* noop */ });
		clonePools.push(p);
		return p;
	}

	/**
	 * Helper: Set up initial schema with seeded data.
	 */
	async function setupInitialSchemaWithData(): Promise<void> {
		// Generate + run initial migration
		const _desired = collectionsToSchema([ItemsV1], 'postgresql');
		const empty = createSchemaSnapshot('postgresql', []);
		generateAndWriteMigration(migrationDir, [ItemsV1], empty, 'initial');

		const migrations = await loadMigrationsFromDisk(migrationDir);
		await runMigrations({
			migrations,
			dialect: 'postgresql',
			tracker: pgTracker(pool),
			buildContext: () => buildPgContext(pool),
		});

		// Seed messy data: NULLs, duplicates
		await pool.query(`INSERT INTO items (id, title, description, quantity, "createdAt", "updatedAt") VALUES
			('id1', 'Item 1', NULL, 10, NOW(), NOW()),
			('id2', 'Item 2', NULL, NULL, NOW(), NOW()),
			('id3', 'Item 3', 'Has description', 5, NOW(), NOW())
		`);
	}

	it('should generate migration with NOT NULL column and detect danger', async () => {
		if (!(await isPgAvailable())) return;

		await setupInitialSchemaWithData();

		// Generate V2 with required 'sku' field (NOT NULL, no default)
		 
		const snapshot = readSnapshot(migrationDir);
		const desired = collectionsToSchema([ItemsV2Required], 'postgresql');
		const diff = diffSchemas(desired, snapshot, 'postgresql');

		// Should detect the addColumn NOT NULL without default as dangerous
		const dangers = detectDangers(diff.operations, 'postgresql');
		expect(dangers.hasErrors).toBe(true);
		const addColDanger = dangers.warnings.find(
			(w) => w.operation.type === 'addColumn' && w.severity === 'error',
		);
		expect(addColDanger).toBeDefined();
		 
		expect(addColDanger?.message).toContain('NOT NULL');
		 
		expect(addColDanger?.suggestion).toContain('nullable');
	});

	it('should block generate when DROP TABLE is detected', async () => {
		if (!(await isPgAvailable())) return;

		await setupInitialSchemaWithData();

		// Diff that removes items table (replaced by other_table)
		 
		const snapshot = readSnapshot(migrationDir);
		const desired = collectionsToSchema([NoItems], 'postgresql');
		const diff = diffSchemas(desired, snapshot, 'postgresql');

		const dangers = detectDangers(diff.operations, 'postgresql');
		expect(dangers.hasErrors).toBe(true);
		const dropTableDanger = dangers.warnings.find(
			(w) => w.operation.type === 'dropTable' && w.severity === 'error',
		);
		expect(dropTableDanger).toBeDefined();
		 
		expect(dropTableDanger?.message).toContain('permanently delete');
	});

	it('should catch NOT NULL violation via clone-test-apply', async () => {
		if (!(await isPgAvailable())) return;

		await setupInitialSchemaWithData();

		// Manually write a migration that tries to add NOT NULL column
		const migName = generateMigrationName('add_required_sku');
		const content = `
export const meta = {
	name: '${migName}',
	description: 'Add required sku column',
	operations: [{ type: 'addColumn', table: 'items', column: 'sku', nullable: false, defaultValue: null }],
};

export async function up(ctx) {
	await ctx.sql('ALTER TABLE "items" ADD COLUMN "sku" TEXT NOT NULL');
}

export async function down(ctx) {
	await ctx.sql('ALTER TABLE "items" DROP COLUMN "sku"');
}
`;
		writeFileSync(join(migrationDir, `${migName}.ts`), content, 'utf-8');

		const migrations = await loadMigrationsFromDisk(migrationDir);
		const cloneDb = pgCloneDb(connectionString);

		const result = await cloneTestApply({
			migrations,
			dialect: 'postgresql',
			tracker: pgTracker(pool),
			buildContext: () => buildPgContext(pool),
			db: cloneDb,
			buildCloneTracker: (cloneName: string) => pgTracker(trackedPoolForDb(cloneName)),
			buildCloneContext: (cloneName: string) => buildPgContext(trackedPoolForDb(cloneName)),
			skipDangerDetection: true,
		});

		// Clone test should fail (migration errored on clone)
		expect(result.cloneResult?.failCount).toBeGreaterThan(0);
		expect(result.error).toBeDefined();

		// Real DB should be untouched
		const cols = await pool.query(
			`SELECT column_name FROM information_schema.columns WHERE table_name = 'items' ORDER BY ordinal_position`,
		);
		const colNames = cols.rows.map((r: Record<string, unknown>) => r['column_name']);
		expect(colNames).not.toContain('sku');
	});

	it('should catch type cast failure via clone-test-apply', async () => {
		if (!(await isPgAvailable())) return;

		await setupInitialSchemaWithData();
		// Insert a non-numeric value
		await pool.query(`INSERT INTO items (id, title, description, quantity, "createdAt", "updatedAt")
			VALUES ('id4', 'Bad Qty', NULL, NULL, NOW(), NOW())`);
		// Set description to a non-integer string for casting test
		await pool.query(`UPDATE items SET description = 'not-a-number' WHERE id = 'id1'`);

		// Manually write a migration that tries to cast text → integer
		const migName = generateMigrationName('cast_desc_to_int');
		const content = `
export const meta = {
	name: '${migName}',
	description: 'Cast description to integer',
	operations: [{ type: 'alterColumnType', table: 'items', column: 'description', fromType: 'TEXT', toType: 'INTEGER' }],
};

export async function up(ctx) {
	await ctx.sql('ALTER TABLE "items" ALTER COLUMN "description" TYPE INTEGER USING "description"::INTEGER');
}

export async function down(ctx) {
	await ctx.sql('ALTER TABLE "items" ALTER COLUMN "description" TYPE TEXT USING "description"::TEXT');
}
`;
		writeFileSync(join(migrationDir, `${migName}.ts`), content, 'utf-8');

		const migrations = await loadMigrationsFromDisk(migrationDir);
		const cloneDb = pgCloneDb(connectionString);

		const result = await cloneTestApply({
			migrations,
			dialect: 'postgresql',
			tracker: pgTracker(pool),
			buildContext: () => buildPgContext(pool),
			db: cloneDb,
			buildCloneTracker: (cloneName: string) => pgTracker(trackedPoolForDb(cloneName)),
			buildCloneContext: (cloneName: string) => buildPgContext(trackedPoolForDb(cloneName)),
			skipDangerDetection: true,
		});

		expect(result.cloneResult?.failCount).toBeGreaterThan(0);
		expect(result.error).toBeDefined();

		// Real DB description column should still be TEXT
		const cols = await pool.query(
			`SELECT data_type FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'description'`,
		);
		expect(cols.rows[0]['data_type']).toBe('text');
	});

	it('should succeed with safe nullable column addition via clone-test-apply', async () => {
		if (!(await isPgAvailable())) return;

		await setupInitialSchemaWithData();

		// Generate safe V2 migration (nullable sku column)
		 
		const snapshot = readSnapshot(migrationDir);
		generateAndWriteMigration(migrationDir, [ItemsV2Safe], snapshot, 'add_nullable_sku');

		const migrations = await loadMigrationsFromDisk(migrationDir);
		const cloneDb = pgCloneDb(connectionString);

		const result = await cloneTestApply({
			migrations,
			dialect: 'postgresql',
			tracker: pgTracker(pool),
			buildContext: () => buildPgContext(pool),
			db: cloneDb,
			buildCloneTracker: (cloneName: string) => pgTracker(trackedPoolForDb(cloneName)),
			buildCloneContext: (cloneName: string) => buildPgContext(trackedPoolForDb(cloneName)),
		});

		// Clone should succeed and apply to real DB
		expect(result.phase).toBe('complete');
		expect(result.applyResult).not.toBeNull();
		 
		expect(result.applyResult?.successCount).toBe(1);
		const cols = await pool.query(
			`SELECT column_name FROM information_schema.columns WHERE table_name = 'items' ORDER BY ordinal_position`,
		);
		const colNames = cols.rows.map((r: Record<string, unknown>) => r['column_name']);
		expect(colNames).toContain('sku');
	});

	it('should not apply to real DB in testOnly mode even on success', async () => {
		if (!(await isPgAvailable())) return;

		await setupInitialSchemaWithData();

		 
		const snapshot = readSnapshot(migrationDir);
		generateAndWriteMigration(migrationDir, [ItemsV2Safe], snapshot, 'add_sku_test');

		const migrations = await loadMigrationsFromDisk(migrationDir);
		const cloneDb = pgCloneDb(connectionString);

		const result = await cloneTestApply({
			migrations,
			dialect: 'postgresql',
			tracker: pgTracker(pool),
			buildContext: () => buildPgContext(pool),
			db: cloneDb,
			buildCloneTracker: (cloneName: string) => pgTracker(trackedPoolForDb(cloneName)),
			buildCloneContext: (cloneName: string) => buildPgContext(trackedPoolForDb(cloneName)),
			testOnly: true,
		});

		expect(result.phase).toBe('skipped');
		// Real DB should NOT have sku column (testOnly skips apply)
		expect(result.applyResult).toBeNull();
		const cols = await pool.query(
			`SELECT column_name FROM information_schema.columns WHERE table_name = 'items' ORDER BY ordinal_position`,
		);
		const colNames = cols.rows.map((r: Record<string, unknown>) => r['column_name']);
		expect(colNames).not.toContain('sku');
	});

	it('should generate suggestion for NOT NULL clone failure', async () => {
		if (!(await isPgAvailable())) return;

		await setupInitialSchemaWithData();

		const migName = generateMigrationName('add_required_sku');
		const content = `
export const meta = {
	name: '${migName}',
	description: 'Add required sku column',
	operations: [{ type: 'addColumn', table: 'items', column: 'sku', nullable: false, defaultValue: null }],
};

export async function up(ctx) {
	await ctx.sql('ALTER TABLE "items" ADD COLUMN "sku" TEXT NOT NULL');
}

export async function down(ctx) {
	await ctx.sql('ALTER TABLE "items" DROP COLUMN "sku"');
}
`;
		writeFileSync(join(migrationDir, `${migName}.ts`), content, 'utf-8');

		const migrations = await loadMigrationsFromDisk(migrationDir);
		const cloneDb = pgCloneDb(connectionString);

		const result = await cloneTestApply({
			migrations,
			dialect: 'postgresql',
			tracker: pgTracker(pool),
			buildContext: () => buildPgContext(pool),
			db: cloneDb,
			buildCloneTracker: (cloneName: string) => pgTracker(trackedPoolForDb(cloneName)),
			buildCloneContext: (cloneName: string) => buildPgContext(trackedPoolForDb(cloneName)),
			skipDangerDetection: true,
		});

		expect(result.cloneResult?.failCount).toBeGreaterThan(0);
		// Should have a suggestion about backfilling
		expect(result.suggestions.length).toBeGreaterThan(0);
		expect(result.suggestions.join(' ')).toMatch(/backfill|DEFAULT|nullable/i);
	});

	it('full lifecycle: initial → break → fix → success', async () => {
		if (!(await isPgAvailable())) return;

		// 1. Setup initial schema + data
		await setupInitialSchemaWithData();

		// 2. Attempt dangerous migration (NOT NULL) → clone catches it
		 
		const snapshot1 = readSnapshot(migrationDir);
		const desired2 = collectionsToSchema([ItemsV2Required], 'postgresql');
		const diff2 = diffSchemas(desired2, snapshot1, 'postgresql');
		const dangers = detectDangers(diff2.operations, 'postgresql');
		expect(dangers.hasErrors).toBe(true);

		// 3. Fix: use safe migration (nullable sku)
		generateAndWriteMigration(migrationDir, [ItemsV2Safe], snapshot1, 'add_sku_safe');

		const migrations = await loadMigrationsFromDisk(migrationDir);
		const cloneDb = pgCloneDb(connectionString);

		const result = await cloneTestApply({
			migrations,
			dialect: 'postgresql',
			tracker: pgTracker(pool),
			buildContext: () => buildPgContext(pool),
			db: cloneDb,
			buildCloneTracker: (cloneName: string) => pgTracker(trackedPoolForDb(cloneName)),
			buildCloneContext: (cloneName: string) => buildPgContext(trackedPoolForDb(cloneName)),
		});

		// 4. Safe migration succeeds
		expect(result.phase).toBe('complete');
		expect(result.applyResult).not.toBeNull();
		 
		expect(result.applyResult?.successCount).toBeGreaterThan(0);

		// 5. Verify real DB has sku column
		const cols = await pool.query(
			`SELECT column_name FROM information_schema.columns WHERE table_name = 'items'`,
		);
		const colNames = cols.rows.map((r: Record<string, unknown>) => r['column_name']);
		expect(colNames).toContain('sku');
	});
});
