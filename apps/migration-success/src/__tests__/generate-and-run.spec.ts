/**
 * Happy-path integration tests for the Payload-style migration workflow.
 *
 * Exercises the full cycle: generate → load → run → status → rollback → re-run.
 * Uses temp dirs for migration files so tests are fully isolated.
 * Tests both PostgreSQL and SQLite.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { mkdirSync, rmSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Pool } from 'pg';
import Database from 'better-sqlite3';
import { defineCollection, text, select } from '@momentumcms/core';
import {
	collectionsToSchema,
	diffSchemas,
	generateMigrationFileContent,
	generateMigrationName,
	readSnapshot,
	writeSnapshot,
	loadMigrationsFromDisk,
	runMigrations,
	rollbackBatch,
	getMigrationStatus,
	createSchemaSnapshot,
} from '@momentumcms/migrations';
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
	pgTracker,
	pgQueryFn,
	buildPgContext,
	sqliteTracker,
	sqliteQueryFn,
	buildSqliteContext,
} from '../../../migration-tests/src/helpers/adapter-wiring';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { isPgAvailable } from '../../../migration-tests/src/helpers/pg-availability';
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
	createTestPgDb,
	dropTestPgDb,
	createTestSqliteDb,
	dropTestSqliteDb,
} from '../../../migration-tests/src/helpers/test-db';
import { introspectPostgres, introspectSqlite } from '@momentumcms/migrations';

// ============================================
// Test collections: "before" and "after" states
// ============================================

const BlogV1 = defineCollection({
	slug: 'blogs',
	fields: [text('title', { required: true }), text('body')],
});

const BlogV2 = defineCollection({
	slug: 'blogs',
	fields: [
		text('title', { required: true }),
		text('body'),
		select('status', {
			options: [
				{ label: 'Draft', value: 'draft' },
				{ label: 'Published', value: 'published' },
			],
		}),
		text('slug'),
	],
});

const Authors = defineCollection({
	slug: 'authors',
	fields: [text('name', { required: true }), text('bio')],
});

// ============================================
// PostgreSQL Tests
// ============================================

describe('generate-and-run (PostgreSQL)', () => {
	let pool: Pool;
	let dbName: string;
	let migrationDir: string;

	beforeAll(async () => {
		if (!(await isPgAvailable())) return;
	});

	beforeEach(async () => {
		if (!(await isPgAvailable())) return;

		const testDb = await createTestPgDb();
		dbName = testDb.dbName;
		pool = new Pool({ connectionString: testDb.connectionString, max: 5 });

		migrationDir = join(
			tmpdir(),
			`mig-success-pg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		mkdirSync(migrationDir, { recursive: true });
	});

	afterEach(async () => {
		if (pool) await pool.end();
		if (dbName) await dropTestPgDb(dbName);
		if (migrationDir && existsSync(migrationDir)) {
			rmSync(migrationDir, { recursive: true, force: true });
		}
	});

	it('should generate initial migration from empty DB', async () => {
		if (!(await isPgAvailable())) return;

		const desired = collectionsToSchema([BlogV1], 'postgresql');
		const previous = createSchemaSnapshot('postgresql', []);

		const diff = diffSchemas(desired, previous, 'postgresql');
		expect(diff.operations.length).toBeGreaterThan(0);

		const name = generateMigrationName('initial', new Date('2024-01-15T12:00:00Z'));
		const content = generateMigrationFileContent(diff, { name, dialect: 'postgresql' });

		writeFileSync(join(migrationDir, `${name}.ts`), content, 'utf-8');
		writeSnapshot(migrationDir, desired);

		// Verify file was written
		const files = readdirSync(migrationDir).filter((f) => f.endsWith('.ts'));
		expect(files).toHaveLength(1);
		expect(files[0]).toMatch(/^\d{14}_initial\.ts$/);

		// Verify snapshot was written
		const snapshot = readSnapshot(migrationDir);
		expect(snapshot).not.toBeNull();
		 
		expect(snapshot?.tables.length).toBeGreaterThan(0);
	});

	it('should load generated migration from disk', async () => {
		if (!(await isPgAvailable())) return;

		const desired = collectionsToSchema([BlogV1], 'postgresql');
		const previous = createSchemaSnapshot('postgresql', []);
		const diff = diffSchemas(desired, previous, 'postgresql');
		const name = generateMigrationName('initial', new Date('2024-01-15T12:00:00Z'));
		const content = generateMigrationFileContent(diff, { name, dialect: 'postgresql' });
		writeFileSync(join(migrationDir, `${name}.ts`), content, 'utf-8');

		const loaded = await loadMigrationsFromDisk(migrationDir);
		expect(loaded).toHaveLength(1);
		expect(loaded[0].name).toMatch(/^\d{14}_initial$/);
		expect(loaded[0].file.meta.name).toBe(name);
		expect(typeof loaded[0].file.up).toBe('function');
		expect(typeof loaded[0].file.down).toBe('function');
	});

	it('should run generated migration and create tables', async () => {
		if (!(await isPgAvailable())) return;

		// Generate
		const desired = collectionsToSchema([BlogV1], 'postgresql');
		const previous = createSchemaSnapshot('postgresql', []);
		const diff = diffSchemas(desired, previous, 'postgresql');
		const name = generateMigrationName('initial', new Date('2024-01-15T12:00:00Z'));
		writeFileSync(
			join(migrationDir, `${name}.ts`),
			generateMigrationFileContent(diff, { name, dialect: 'postgresql' }),
			'utf-8',
		);

		// Load + run
		const migrations = await loadMigrationsFromDisk(migrationDir);
		const result = await runMigrations({
			migrations,
			dialect: 'postgresql',
			tracker: pgTracker(pool),
			buildContext: () => buildPgContext(pool),
		});

		expect(result.successCount).toBe(1);
		expect(result.failCount).toBe(0);
		expect(result.batch).toBe(1);

		// Verify table exists
		const tables = await pool.query(
			`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'blogs'`,
		);
		expect(tables.rows).toHaveLength(1);
	});

	it('should report "no changes" when schema is up to date', async () => {
		if (!(await isPgAvailable())) return;

		const desired = collectionsToSchema([BlogV1], 'postgresql');
		writeSnapshot(migrationDir, desired);

		// Diff against same snapshot → no changes
		 
		const previous = readSnapshot(migrationDir);
		const diff = diffSchemas(desired, previous, 'postgresql');
		expect(diff.operations).toHaveLength(0);
	});

	it('should generate incremental migration when adding a field', async () => {
		if (!(await isPgAvailable())) return;

		// Initial migration
		const desiredV1 = collectionsToSchema([BlogV1], 'postgresql');
		const previous = createSchemaSnapshot('postgresql', []);
		const diff1 = diffSchemas(desiredV1, previous, 'postgresql');
		const name1 = generateMigrationName('initial', new Date('2024-01-15T12:00:00Z'));
		writeFileSync(
			join(migrationDir, `${name1}.ts`),
			generateMigrationFileContent(diff1, { name: name1, dialect: 'postgresql' }),
			'utf-8',
		);
		writeSnapshot(migrationDir, desiredV1);

		// Run initial
		let migrations = await loadMigrationsFromDisk(migrationDir);
		await runMigrations({
			migrations,
			dialect: 'postgresql',
			tracker: pgTracker(pool),
			buildContext: () => buildPgContext(pool),
		});

		// Generate V2 migration (adds status + slug columns)
		const desiredV2 = collectionsToSchema([BlogV2], 'postgresql');
		 
		const snapshotV1 = readSnapshot(migrationDir);
		const diff2 = diffSchemas(desiredV2, snapshotV1, 'postgresql');
		expect(diff2.operations.length).toBeGreaterThan(0);

		const name2 = generateMigrationName('add_status_slug', new Date('2024-02-01T12:00:00Z'));
		writeFileSync(
			join(migrationDir, `${name2}.ts`),
			generateMigrationFileContent(diff2, { name: name2, dialect: 'postgresql' }),
			'utf-8',
		);
		writeSnapshot(migrationDir, desiredV2);

		// Run V2
		migrations = await loadMigrationsFromDisk(migrationDir);
		const result = await runMigrations({
			migrations,
			dialect: 'postgresql',
			tracker: pgTracker(pool),
			buildContext: () => buildPgContext(pool),
		});

		// Only the new migration should run (1st is already applied)
		expect(result.successCount).toBe(1);
		expect(result.batch).toBe(2);

		// Verify new columns exist
		const cols = await pool.query(
			`SELECT column_name FROM information_schema.columns WHERE table_name = 'blogs' ORDER BY ordinal_position`,
		);
		const colNames = cols.rows.map((r: Record<string, unknown>) => r['column_name']);
		expect(colNames).toContain('status');
		expect(colNames).toContain('slug');
	});

	it('should show correct status after migrations', async () => {
		if (!(await isPgAvailable())) return;

		// Generate + run two migrations
		const desiredV1 = collectionsToSchema([BlogV1], 'postgresql');
		const diff1 = diffSchemas(desiredV1, createSchemaSnapshot('postgresql', []), 'postgresql');
		const name1 = generateMigrationName('initial', new Date('2024-01-15T12:00:00Z'));
		writeFileSync(
			join(migrationDir, `${name1}.ts`),
			generateMigrationFileContent(diff1, { name: name1, dialect: 'postgresql' }),
			'utf-8',
		);
		writeSnapshot(migrationDir, desiredV1);

		let migrations = await loadMigrationsFromDisk(migrationDir);
		await runMigrations({
			migrations,
			dialect: 'postgresql',
			tracker: pgTracker(pool),
			buildContext: () => buildPgContext(pool),
		});

		const desiredV2 = collectionsToSchema([BlogV2], 'postgresql');
		 
		const diff2 = diffSchemas(desiredV2, readSnapshot(migrationDir), 'postgresql');
		const name2 = generateMigrationName('add_fields', new Date('2024-02-01T12:00:00Z'));
		writeFileSync(
			join(migrationDir, `${name2}.ts`),
			generateMigrationFileContent(diff2, { name: name2, dialect: 'postgresql' }),
			'utf-8',
		);
		writeSnapshot(migrationDir, desiredV2);

		migrations = await loadMigrationsFromDisk(migrationDir);
		await runMigrations({
			migrations,
			dialect: 'postgresql',
			tracker: pgTracker(pool),
			buildContext: () => buildPgContext(pool),
		});

		// Status check
		const status = await getMigrationStatus(migrations, pgTracker(pool), 'postgresql');
		expect(status).toHaveLength(2);
		expect(status[0].status).toBe('applied');
		expect(status[0].batch).toBe(1);
		expect(status[1].status).toBe('applied');
		expect(status[1].batch).toBe(2);
	});

	it('should rollback latest batch', async () => {
		if (!(await isPgAvailable())) return;

		// Generate + run two migrations
		const desiredV1 = collectionsToSchema([BlogV1], 'postgresql');
		const diff1 = diffSchemas(desiredV1, createSchemaSnapshot('postgresql', []), 'postgresql');
		const name1 = generateMigrationName('initial', new Date('2024-01-15T12:00:00Z'));
		writeFileSync(
			join(migrationDir, `${name1}.ts`),
			generateMigrationFileContent(diff1, { name: name1, dialect: 'postgresql' }),
			'utf-8',
		);
		writeSnapshot(migrationDir, desiredV1);

		let migrations = await loadMigrationsFromDisk(migrationDir);
		await runMigrations({
			migrations,
			dialect: 'postgresql',
			tracker: pgTracker(pool),
			buildContext: () => buildPgContext(pool),
		});

		const desiredV2 = collectionsToSchema([BlogV2], 'postgresql');
		 
		const diff2 = diffSchemas(desiredV2, readSnapshot(migrationDir), 'postgresql');
		const name2 = generateMigrationName('add_fields', new Date('2024-02-01T12:00:00Z'));
		writeFileSync(
			join(migrationDir, `${name2}.ts`),
			generateMigrationFileContent(diff2, { name: name2, dialect: 'postgresql' }),
			'utf-8',
		);
		writeSnapshot(migrationDir, desiredV2);

		migrations = await loadMigrationsFromDisk(migrationDir);
		await runMigrations({
			migrations,
			dialect: 'postgresql',
			tracker: pgTracker(pool),
			buildContext: () => buildPgContext(pool),
		});

		// Rollback batch 2
		const rollbackResult = await rollbackBatch({
			migrations,
			dialect: 'postgresql',
			tracker: pgTracker(pool),
			buildContext: () => buildPgContext(pool),
		});

		expect(rollbackResult.batch).toBe(2);
		expect(rollbackResult.successCount).toBe(1);

		// Check status: 1 applied, 1 pending
		const status = await getMigrationStatus(migrations, pgTracker(pool), 'postgresql');
		expect(status[0].status).toBe('applied');
		expect(status[1].status).toBe('pending');
	});

	it('should re-run after rollback', async () => {
		if (!(await isPgAvailable())) return;

		// Setup: generate + run 2 migrations, rollback batch 2
		const desiredV1 = collectionsToSchema([BlogV1], 'postgresql');
		const diff1 = diffSchemas(desiredV1, createSchemaSnapshot('postgresql', []), 'postgresql');
		const name1 = generateMigrationName('initial', new Date('2024-01-15T12:00:00Z'));
		writeFileSync(
			join(migrationDir, `${name1}.ts`),
			generateMigrationFileContent(diff1, { name: name1, dialect: 'postgresql' }),
			'utf-8',
		);
		writeSnapshot(migrationDir, desiredV1);

		let migrations = await loadMigrationsFromDisk(migrationDir);
		await runMigrations({
			migrations,
			dialect: 'postgresql',
			tracker: pgTracker(pool),
			buildContext: () => buildPgContext(pool),
		});

		const desiredV2 = collectionsToSchema([BlogV2], 'postgresql');
		 
		const diff2 = diffSchemas(desiredV2, readSnapshot(migrationDir), 'postgresql');
		const name2 = generateMigrationName('add_fields', new Date('2024-02-01T12:00:00Z'));
		writeFileSync(
			join(migrationDir, `${name2}.ts`),
			generateMigrationFileContent(diff2, { name: name2, dialect: 'postgresql' }),
			'utf-8',
		);
		writeSnapshot(migrationDir, desiredV2);

		migrations = await loadMigrationsFromDisk(migrationDir);
		await runMigrations({
			migrations,
			dialect: 'postgresql',
			tracker: pgTracker(pool),
			buildContext: () => buildPgContext(pool),
		});

		await rollbackBatch({
			migrations,
			dialect: 'postgresql',
			tracker: pgTracker(pool),
			buildContext: () => buildPgContext(pool),
		});

		// Re-run: should re-apply the rolled-back migration
		const rerunResult = await runMigrations({
			migrations,
			dialect: 'postgresql',
			tracker: pgTracker(pool),
			buildContext: () => buildPgContext(pool),
		});

		expect(rerunResult.successCount).toBe(1);
		// After rolling back batch 2, MAX(batch) is 1, so next batch is 2
		expect(rerunResult.batch).toBe(2);

		const status = await getMigrationStatus(migrations, pgTracker(pool), 'postgresql');
		expect(status.every((s) => s.status === 'applied')).toBe(true);
	});

	it('should handle multiple collections in a single migration', async () => {
		if (!(await isPgAvailable())) return;

		const desired = collectionsToSchema([BlogV1, Authors], 'postgresql');
		const diff = diffSchemas(desired, createSchemaSnapshot('postgresql', []), 'postgresql');
		const name = generateMigrationName('multi', new Date('2024-03-01T12:00:00Z'));
		writeFileSync(
			join(migrationDir, `${name}.ts`),
			generateMigrationFileContent(diff, { name, dialect: 'postgresql' }),
			'utf-8',
		);

		const migrations = await loadMigrationsFromDisk(migrationDir);
		const result = await runMigrations({
			migrations,
			dialect: 'postgresql',
			tracker: pgTracker(pool),
			buildContext: () => buildPgContext(pool),
		});

		expect(result.successCount).toBe(1);

		// Both tables exist
		const tables = await pool.query(
			`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('blogs', 'authors') ORDER BY table_name`,
		);
		expect(tables.rows).toHaveLength(2);
	});

	it('should produce snapshot matching introspected DB state', async () => {
		if (!(await isPgAvailable())) return;

		const desired = collectionsToSchema([BlogV1, Authors], 'postgresql');
		const diff = diffSchemas(desired, createSchemaSnapshot('postgresql', []), 'postgresql');
		const name = generateMigrationName('initial', new Date('2024-01-15T12:00:00Z'));
		writeFileSync(
			join(migrationDir, `${name}.ts`),
			generateMigrationFileContent(diff, { name, dialect: 'postgresql' }),
			'utf-8',
		);
		writeSnapshot(migrationDir, desired);

		const migrations = await loadMigrationsFromDisk(migrationDir);
		await runMigrations({
			migrations,
			dialect: 'postgresql',
			tracker: pgTracker(pool),
			buildContext: () => buildPgContext(pool),
		});

		// Introspect and compare
		const introspected = await introspectPostgres(pgQueryFn(pool));
		 
		const snapshot = readSnapshot(migrationDir);

		// Both should have the same user tables (snapshot has all, introspected filters internal)
		const snapshotTableNames = snapshot.tables.map((t) => t.name).sort();
		const introspectedTableNames = introspected.tables.map((t) => t.name).sort();

		// Introspected may include the tracking table; snapshot won't
		for (const tableName of snapshotTableNames) {
			expect(introspectedTableNames).toContain(tableName);
		}
	});
});

// ============================================
// SQLite Tests
// ============================================

describe('generate-and-run (SQLite)', () => {
	let db: Database.Database;
	let dbPath: string;
	let tempDbDir: string;
	let migrationDir: string;

	beforeEach(async () => {
		const testDb = await createTestSqliteDb();
		dbPath = testDb.dbPath;
		tempDbDir = testDb.tempDir;
		db = new Database(dbPath);

		migrationDir = join(
			tmpdir(),
			`mig-success-sqlite-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		mkdirSync(migrationDir, { recursive: true });
	});

	afterEach(async () => {
		if (db) db.close();
		if (tempDbDir) await dropTestSqliteDb(tempDbDir);
		if (migrationDir && existsSync(migrationDir)) {
			rmSync(migrationDir, { recursive: true, force: true });
		}
	});

	it('should generate and run initial migration', async () => {
		const desired = collectionsToSchema([BlogV1], 'sqlite');
		const diff = diffSchemas(desired, createSchemaSnapshot('sqlite', []), 'sqlite');
		const name = generateMigrationName('initial', new Date('2024-01-15T12:00:00Z'));
		writeFileSync(
			join(migrationDir, `${name}.ts`),
			generateMigrationFileContent(diff, { name, dialect: 'sqlite' }),
			'utf-8',
		);

		const migrations = await loadMigrationsFromDisk(migrationDir);
		const result = await runMigrations({
			migrations,
			dialect: 'sqlite',
			tracker: sqliteTracker(db),
			buildContext: () => buildSqliteContext(db),
		});

		expect(result.successCount).toBe(1);
		expect(result.failCount).toBe(0);

		// Verify table exists
		const tables = db
			.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='blogs'")
			.all();
		expect(tables).toHaveLength(1);
	});

	it('should generate incremental migration and run both', async () => {
		// V1
		const desiredV1 = collectionsToSchema([BlogV1], 'sqlite');
		const diff1 = diffSchemas(desiredV1, createSchemaSnapshot('sqlite', []), 'sqlite');
		const name1 = generateMigrationName('initial', new Date('2024-01-15T12:00:00Z'));
		writeFileSync(
			join(migrationDir, `${name1}.ts`),
			generateMigrationFileContent(diff1, { name: name1, dialect: 'sqlite' }),
			'utf-8',
		);
		writeSnapshot(migrationDir, desiredV1);

		let migrations = await loadMigrationsFromDisk(migrationDir);
		await runMigrations({
			migrations,
			dialect: 'sqlite',
			tracker: sqliteTracker(db),
			buildContext: () => buildSqliteContext(db),
		});

		// V2
		const desiredV2 = collectionsToSchema([BlogV2], 'sqlite');
		 
		const diff2 = diffSchemas(desiredV2, readSnapshot(migrationDir), 'sqlite');
		expect(diff2.operations.length).toBeGreaterThan(0);

		const name2 = generateMigrationName('add_fields', new Date('2024-02-01T12:00:00Z'));
		writeFileSync(
			join(migrationDir, `${name2}.ts`),
			generateMigrationFileContent(diff2, { name: name2, dialect: 'sqlite' }),
			'utf-8',
		);

		migrations = await loadMigrationsFromDisk(migrationDir);
		const result = await runMigrations({
			migrations,
			dialect: 'sqlite',
			tracker: sqliteTracker(db),
			buildContext: () => buildSqliteContext(db),
		});

		expect(result.successCount).toBe(1);
		expect(result.batch).toBe(2);
	});

	it('should rollback and re-run on SQLite', async () => {
		// Generate + run
		const desired = collectionsToSchema([BlogV1], 'sqlite');
		const diff = diffSchemas(desired, createSchemaSnapshot('sqlite', []), 'sqlite');
		const name = generateMigrationName('initial', new Date('2024-01-15T12:00:00Z'));
		writeFileSync(
			join(migrationDir, `${name}.ts`),
			generateMigrationFileContent(diff, { name, dialect: 'sqlite' }),
			'utf-8',
		);

		let migrations = await loadMigrationsFromDisk(migrationDir);
		await runMigrations({
			migrations,
			dialect: 'sqlite',
			tracker: sqliteTracker(db),
			buildContext: () => buildSqliteContext(db),
		});

		// Rollback
		const rollbackResult = await rollbackBatch({
			migrations,
			dialect: 'sqlite',
			tracker: sqliteTracker(db),
			buildContext: () => buildSqliteContext(db),
		});
		expect(rollbackResult.successCount).toBe(1);

		// Table should be gone
		const tables = db
			.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='blogs'")
			.all();
		expect(tables).toHaveLength(0);

		// Re-run
		migrations = await loadMigrationsFromDisk(migrationDir);
		const rerun = await runMigrations({
			migrations,
			dialect: 'sqlite',
			tracker: sqliteTracker(db),
			buildContext: () => buildSqliteContext(db),
		});
		expect(rerun.successCount).toBe(1);
		// After rolling back batch 1, no records remain, so next batch is 1
		expect(rerun.batch).toBe(1);
	});

	it('should produce snapshot matching introspected DB state', async () => {
		const desired = collectionsToSchema([BlogV1], 'sqlite');
		const diff = diffSchemas(desired, createSchemaSnapshot('sqlite', []), 'sqlite');
		const name = generateMigrationName('initial', new Date('2024-01-15T12:00:00Z'));
		writeFileSync(
			join(migrationDir, `${name}.ts`),
			generateMigrationFileContent(diff, { name, dialect: 'sqlite' }),
			'utf-8',
		);
		writeSnapshot(migrationDir, desired);

		const migrations = await loadMigrationsFromDisk(migrationDir);
		await runMigrations({
			migrations,
			dialect: 'sqlite',
			tracker: sqliteTracker(db),
			buildContext: () => buildSqliteContext(db),
		});

		const introspected = await introspectSqlite(sqliteQueryFn(db));
		 
		const snapshot = readSnapshot(migrationDir);

		const snapshotTableNames = snapshot.tables.map((t) => t.name).sort();
		const introspectedTableNames = introspected.tables.map((t) => t.name).sort();

		for (const tableName of snapshotTableNames) {
			expect(introspectedTableNames).toContain(tableName);
		}
	});
});
