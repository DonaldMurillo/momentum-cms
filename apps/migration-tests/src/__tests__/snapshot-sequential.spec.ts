/**
 * Integration tests: Per-migration snapshots and sequential generation.
 *
 * Verifies that per-migration snapshot files are created alongside migration
 * files, that readSnapshot picks up the latest per-migration snapshot, and
 * that sequential generate+run works correctly with the new naming scheme.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { defineCollection, text, select } from '@momentumcms/core';
import {
	collectionsToSchema,
	diffSchemas,
	generateMigrationFileContent,
	generateMigrationName,
	readSnapshot,
	writeSnapshot,
	writePerMigrationSnapshot,
	findLatestPerMigrationSnapshot,
	loadMigrationsFromDisk,
	runMigrations,
	createSchemaSnapshot,
} from '@momentumcms/migrations';
import { createTestSqliteDb, dropTestSqliteDb } from '../helpers/test-db';
import { sqliteTracker, buildSqliteContext } from '../helpers/adapter-wiring';

// ============================================
// Test collections: V1, V2, V3
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
	],
});

const BlogV3 = defineCollection({
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
// SQLite: 3-step sequential generate + run
// ============================================

describe('snapshot-sequential (SQLite)', () => {
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
			`snap-seq-sqlite-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

	it('should create per-migration snapshots during 3-step sequential generation', async () => {
		// --- Step 1: Generate V1 (blogs table) ---
		const desiredV1 = collectionsToSchema([BlogV1], 'sqlite');
		const diff1 = diffSchemas(desiredV1, createSchemaSnapshot('sqlite', []), 'sqlite');
		expect(diff1.operations.length).toBeGreaterThan(0);

		const name1 = generateMigrationName('initial', new Date('2024-01-15T12:00:00Z'));
		writeFileSync(
			join(migrationDir, `${name1}.ts`),
			generateMigrationFileContent(diff1, { name: name1, dialect: 'sqlite' }),
			'utf-8',
		);
		writePerMigrationSnapshot(migrationDir, name1, desiredV1);

		// Run V1
		let migrations = await loadMigrationsFromDisk(migrationDir);
		const result1 = await runMigrations({
			migrations,
			dialect: 'sqlite',
			tracker: sqliteTracker(db),
			buildContext: () => buildSqliteContext(db),
		});
		expect(result1.successCount).toBe(1);

		// --- Step 2: Generate V2 (add status field) ---
		const desiredV2 = collectionsToSchema([BlogV2], 'sqlite');
		const snapshotV1 = readSnapshot(migrationDir);
		expect(snapshotV1).not.toBeNull();
		expect(snapshotV1?.checksum).toBe(desiredV1.checksum);

		const diff2 = diffSchemas(desiredV2, snapshotV1, 'sqlite');
		expect(diff2.operations.length).toBeGreaterThan(0);

		const name2 = generateMigrationName('add_status', new Date('2024-02-01T12:00:00Z'));
		writeFileSync(
			join(migrationDir, `${name2}.ts`),
			generateMigrationFileContent(diff2, { name: name2, dialect: 'sqlite' }),
			'utf-8',
		);
		writePerMigrationSnapshot(migrationDir, name2, desiredV2);

		// Run V2
		migrations = await loadMigrationsFromDisk(migrationDir);
		const result2 = await runMigrations({
			migrations,
			dialect: 'sqlite',
			tracker: sqliteTracker(db),
			buildContext: () => buildSqliteContext(db),
		});
		expect(result2.successCount).toBe(1);
		expect(result2.batch).toBe(2);

		// --- Step 3: Generate V3 (add slug field + authors table) ---
		const desiredV3 = collectionsToSchema([BlogV3, Authors], 'sqlite');
		const snapshotV2 = readSnapshot(migrationDir);
		expect(snapshotV2).not.toBeNull();
		expect(snapshotV2?.checksum).toBe(desiredV2.checksum);

		const diff3 = diffSchemas(desiredV3, snapshotV2, 'sqlite');
		expect(diff3.operations.length).toBeGreaterThan(0);

		const name3 = generateMigrationName('add_slug_authors', new Date('2024-03-01T12:00:00Z'));
		writeFileSync(
			join(migrationDir, `${name3}.ts`),
			generateMigrationFileContent(diff3, { name: name3, dialect: 'sqlite' }),
			'utf-8',
		);
		writePerMigrationSnapshot(migrationDir, name3, desiredV3);

		// Run V3
		migrations = await loadMigrationsFromDisk(migrationDir);
		const result3 = await runMigrations({
			migrations,
			dialect: 'sqlite',
			tracker: sqliteTracker(db),
			buildContext: () => buildSqliteContext(db),
		});
		expect(result3.successCount).toBe(1);
		expect(result3.batch).toBe(3);

		// --- Verify per-migration snapshot files exist ---
		const snapshotFiles = readdirSync(migrationDir)
			.filter((f) => f.endsWith('.snapshot.json'))
			.sort();
		expect(snapshotFiles).toHaveLength(3);
		expect(snapshotFiles[0]).toBe(`${name1}.snapshot.json`);
		expect(snapshotFiles[1]).toBe(`${name2}.snapshot.json`);
		expect(snapshotFiles[2]).toBe(`${name3}.snapshot.json`);

		// --- Verify readSnapshot returns latest (V3) ---
		const latestSnapshot = readSnapshot(migrationDir);
		expect(latestSnapshot?.checksum).toBe(desiredV3.checksum);
		expect(latestSnapshot?.tables.length).toBeGreaterThanOrEqual(2);

		// --- Verify migration files exist ---
		const migrationFiles = readdirSync(migrationDir)
			.filter((f) => f.endsWith('.ts'))
			.sort();
		expect(migrationFiles).toHaveLength(3);

		// --- Verify tables and columns exist in DB ---
		const blogs = db
			.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='blogs'")
			.all();
		expect(blogs).toHaveLength(1);

		const authors = db
			.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='authors'")
			.all();
		expect(authors).toHaveLength(1);

		// Verify columns were actually created by sequential migrations
		const blogCols = db.prepare("PRAGMA table_info('blogs')").all() as { name: string }[];
		const blogColNames = blogCols.map((c) => c.name);
		expect(blogColNames).toContain('title');
		expect(blogColNames).toContain('body');
		expect(blogColNames).toContain('status'); // Added in V2
		expect(blogColNames).toContain('slug'); // Added in V3

		const authorCols = db.prepare("PRAGMA table_info('authors')").all() as { name: string }[];
		const authorColNames = authorCols.map((c) => c.name);
		expect(authorColNames).toContain('name');
		expect(authorColNames).toContain('bio');
	});

	it('should fall back to legacy .snapshot.json when no per-migration snapshots exist', async () => {
		const desiredV1 = collectionsToSchema([BlogV1], 'sqlite');
		// Write only legacy snapshot (simulating old behavior)
		writeSnapshot(migrationDir, desiredV1);

		const snapshot = readSnapshot(migrationDir);
		expect(snapshot).not.toBeNull();
		expect(snapshot?.checksum).toBe(desiredV1.checksum);

		// Generate V2 migration from legacy snapshot
		const desiredV2 = collectionsToSchema([BlogV2], 'sqlite');
		const diff = diffSchemas(desiredV2, snapshot, 'sqlite');
		expect(diff.operations.length).toBeGreaterThan(0);
	});

	it('should prefer per-migration snapshot over legacy .snapshot.json', async () => {
		const desiredV1 = collectionsToSchema([BlogV1], 'sqlite');
		const desiredV2 = collectionsToSchema([BlogV2], 'sqlite');

		// Write legacy snapshot with V1
		writeSnapshot(migrationDir, desiredV1);

		// Write per-migration snapshot with V2
		const name = generateMigrationName('add_status', new Date('2024-02-01T12:00:00Z'));
		writePerMigrationSnapshot(migrationDir, name, desiredV2);

		// readSnapshot should return V2 (per-migration), not V1 (legacy)
		const snapshot = readSnapshot(migrationDir);
		expect(snapshot?.checksum).toBe(desiredV2.checksum);
	});

	it('should fall back to legacy when per-migration snapshots are deleted', async () => {
		const desiredV1 = collectionsToSchema([BlogV1], 'sqlite');
		const desiredV2 = collectionsToSchema([BlogV2], 'sqlite');

		// Write legacy with V1
		writeSnapshot(migrationDir, desiredV1);

		// Write per-migration with V2
		const name = generateMigrationName('add_status', new Date('2024-02-01T12:00:00Z'));
		writePerMigrationSnapshot(migrationDir, name, desiredV2);

		// Delete per-migration snapshot
		unlinkSync(join(migrationDir, `${name}.snapshot.json`));

		// Should fall back to legacy V1
		const snapshot = readSnapshot(migrationDir);
		expect(snapshot?.checksum).toBe(desiredV1.checksum);
	});

	it('findLatestPerMigrationSnapshot should return null when only legacy exists', () => {
		const snapshot = createSchemaSnapshot('sqlite', []);
		writeSnapshot(migrationDir, snapshot);

		const result = findLatestPerMigrationSnapshot(migrationDir);
		expect(result).toBeNull();
	});

	it('should correctly diff each sequential step against its predecessor', async () => {
		// V1: just title + body
		const desiredV1 = collectionsToSchema([BlogV1], 'sqlite');
		const name1 = generateMigrationName('initial', new Date('2024-01-15T12:00:00Z'));
		writePerMigrationSnapshot(migrationDir, name1, desiredV1);

		// V2: add status — diff against V1
		const desiredV2 = collectionsToSchema([BlogV2], 'sqlite');
		const snap1 = readSnapshot(migrationDir);
		const diff2 = diffSchemas(desiredV2, snap1, 'sqlite');
		// Should detect the added status column, not recreate the whole table
		const addOps = diff2.operations.filter((op) => op.type === 'addColumn');
		expect(addOps.length).toBeGreaterThan(0);
		const createOps = diff2.operations.filter((op) => op.type === 'createTable');
		expect(createOps).toHaveLength(0);

		const name2 = generateMigrationName('add_status', new Date('2024-02-01T12:00:00Z'));
		writePerMigrationSnapshot(migrationDir, name2, desiredV2);

		// V3: add slug — diff against V2
		const desiredV3 = collectionsToSchema([BlogV3], 'sqlite');
		const snap2 = readSnapshot(migrationDir);
		const diff3 = diffSchemas(desiredV3, snap2, 'sqlite');
		const addOps3 = diff3.operations.filter((op) => op.type === 'addColumn');
		expect(addOps3.length).toBeGreaterThan(0);
		const createOps3 = diff3.operations.filter((op) => op.type === 'createTable');
		expect(createOps3).toHaveLength(0);
	});
});
