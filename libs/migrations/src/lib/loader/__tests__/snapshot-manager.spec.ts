import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
	readSnapshot,
	writeSnapshot,
	writePerMigrationSnapshot,
	findLatestPerMigrationSnapshot,
	getSnapshotPath,
} from '../snapshot-manager';
import { createSchemaSnapshot, type TableSnapshot } from '../../schema/schema-snapshot';

describe('snapshot-manager', () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `snapshot-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(tempDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	const sampleTable: TableSnapshot = {
		name: 'posts',
		columns: [
			{ name: 'id', type: 'VARCHAR(36)', nullable: false, defaultValue: null, isPrimaryKey: true },
			{ name: 'title', type: 'TEXT', nullable: false, defaultValue: null, isPrimaryKey: false },
		],
		foreignKeys: [],
		indexes: [],
	};

	it('returns null for missing snapshot file', () => {
		const result = readSnapshot(tempDir);
		expect(result).toBeNull();
	});

	it('writes and reads a snapshot roundtrip', () => {
		const snapshot = createSchemaSnapshot('postgresql', [sampleTable]);
		writeSnapshot(tempDir, snapshot);

		const read = readSnapshot(tempDir);
		expect(read).not.toBeNull();
		expect(read?.dialect).toBe('postgresql');
		expect(read?.tables).toHaveLength(1);
		expect(read?.tables[0].name).toBe('posts');
		expect(read?.tables[0].columns).toHaveLength(2);
		expect(read?.checksum).toBe(snapshot.checksum);
	});

	it('overwrites existing snapshot', () => {
		const snapshot1 = createSchemaSnapshot('postgresql', [sampleTable]);
		writeSnapshot(tempDir, snapshot1);

		const updatedTable: TableSnapshot = {
			...sampleTable,
			columns: [
				...sampleTable.columns,
				{ name: 'content', type: 'TEXT', nullable: true, defaultValue: null, isPrimaryKey: false },
			],
		};
		const snapshot2 = createSchemaSnapshot('postgresql', [updatedTable]);
		writeSnapshot(tempDir, snapshot2);

		const read = readSnapshot(tempDir);
		expect(read).not.toBeNull();
		expect(read?.tables[0].columns).toHaveLength(3);
		expect(read?.checksum).toBe(snapshot2.checksum);
		expect(read?.checksum).not.toBe(snapshot1.checksum);
	});

	it('creates directory if it does not exist', () => {
		const nestedDir = join(tempDir, 'nested', 'deep');
		const snapshot = createSchemaSnapshot('sqlite', [sampleTable]);

		writeSnapshot(nestedDir, snapshot);

		expect(existsSync(nestedDir)).toBe(true);
		const read = readSnapshot(nestedDir);
		expect(read).not.toBeNull();
		expect(read?.dialect).toBe('sqlite');
	});

	it('getSnapshotPath returns correct path', () => {
		const path = getSnapshotPath(tempDir);
		expect(path).toBe(join(tempDir, '.snapshot.json'));
	});

	// ============================================
	// Per-migration snapshot tests
	// ============================================

	it('writePerMigrationSnapshot creates correctly named file', () => {
		const snapshot = createSchemaSnapshot('postgresql', [sampleTable]);
		writePerMigrationSnapshot(tempDir, '20240115120000_initial', snapshot);

		const read = readSnapshot(tempDir);
		expect(read).not.toBeNull();
		expect(read?.tables).toHaveLength(1);
		expect(read?.tables[0].name).toBe('posts');
		expect(existsSync(join(tempDir, '20240115120000_initial.snapshot.json'))).toBe(true);
	});

	it('findLatestPerMigrationSnapshot returns the latest snapshot', () => {
		const snap1 = createSchemaSnapshot('postgresql', [sampleTable]);
		writePerMigrationSnapshot(tempDir, '20240115120000_initial', snap1);

		const updatedTable: TableSnapshot = {
			...sampleTable,
			columns: [
				...sampleTable.columns,
				{ name: 'content', type: 'TEXT', nullable: true, defaultValue: null, isPrimaryKey: false },
			],
		};
		const snap2 = createSchemaSnapshot('postgresql', [updatedTable]);
		writePerMigrationSnapshot(tempDir, '20240201120000_add_content', snap2);

		const authorsTable: TableSnapshot = {
			name: 'authors',
			columns: [
				{
					name: 'id',
					type: 'VARCHAR(36)',
					nullable: false,
					defaultValue: null,
					isPrimaryKey: true,
				},
				{ name: 'name', type: 'TEXT', nullable: false, defaultValue: null, isPrimaryKey: false },
			],
			foreignKeys: [],
			indexes: [],
		};
		const snap3 = createSchemaSnapshot('postgresql', [updatedTable, authorsTable]);
		writePerMigrationSnapshot(tempDir, '20240301120000_add_authors', snap3);

		const latest = findLatestPerMigrationSnapshot(tempDir);
		expect(latest).not.toBeNull();
		expect(latest?.tables).toHaveLength(2);
		expect(latest?.checksum).toBe(snap3.checksum);
	});

	it('readSnapshot prefers per-migration over legacy .snapshot.json', () => {
		const legacySnap = createSchemaSnapshot('postgresql', [sampleTable]);
		writeSnapshot(tempDir, legacySnap);

		const updatedTable: TableSnapshot = {
			...sampleTable,
			columns: [
				...sampleTable.columns,
				{ name: 'content', type: 'TEXT', nullable: true, defaultValue: null, isPrimaryKey: false },
			],
		};
		const perMigrationSnap = createSchemaSnapshot('postgresql', [updatedTable]);
		writePerMigrationSnapshot(tempDir, '20240115120000_initial', perMigrationSnap);

		const read = readSnapshot(tempDir);
		expect(read?.checksum).toBe(perMigrationSnap.checksum);
		expect(read?.tables[0].columns).toHaveLength(3);
	});

	it('readSnapshot falls back to legacy .snapshot.json when no per-migration snapshots exist', () => {
		const snapshot = createSchemaSnapshot('postgresql', [sampleTable]);
		writeSnapshot(tempDir, snapshot);

		const read = readSnapshot(tempDir);
		expect(read).not.toBeNull();
		expect(read?.checksum).toBe(snapshot.checksum);
	});

	it('findLatestPerMigrationSnapshot ignores legacy .snapshot.json', () => {
		const snapshot = createSchemaSnapshot('postgresql', [sampleTable]);
		writeSnapshot(tempDir, snapshot);

		const result = findLatestPerMigrationSnapshot(tempDir);
		expect(result).toBeNull();
	});

	it('findLatestPerMigrationSnapshot returns null for empty directory', () => {
		const result = findLatestPerMigrationSnapshot(tempDir);
		expect(result).toBeNull();
	});

	it('sequential 3-migration snapshot chain returns latest', () => {
		const snap1 = createSchemaSnapshot('postgresql', [sampleTable]);
		writePerMigrationSnapshot(tempDir, '20240115120000_initial', snap1);

		const tableV2: TableSnapshot = {
			...sampleTable,
			columns: [
				...sampleTable.columns,
				{ name: 'status', type: 'TEXT', nullable: true, defaultValue: null, isPrimaryKey: false },
			],
		};
		const snap2 = createSchemaSnapshot('postgresql', [tableV2]);
		writePerMigrationSnapshot(tempDir, '20240201120000_add_status', snap2);

		const tableV3: TableSnapshot = {
			...tableV2,
			columns: [
				...tableV2.columns,
				{ name: 'slug', type: 'TEXT', nullable: true, defaultValue: null, isPrimaryKey: false },
			],
		};
		const snap3 = createSchemaSnapshot('postgresql', [tableV3]);
		writePerMigrationSnapshot(tempDir, '20240301120000_add_slug', snap3);

		// readSnapshot should return the latest (V3)
		const read = readSnapshot(tempDir);
		expect(read?.checksum).toBe(snap3.checksum);
		expect(read?.tables[0].columns).toHaveLength(4);

		// All 3 snapshot files should exist
		expect(existsSync(join(tempDir, '20240115120000_initial.snapshot.json'))).toBe(true);
		expect(existsSync(join(tempDir, '20240201120000_add_status.snapshot.json'))).toBe(true);
		expect(existsSync(join(tempDir, '20240301120000_add_slug.snapshot.json'))).toBe(true);
	});
});
