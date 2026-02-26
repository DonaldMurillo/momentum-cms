import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readSnapshot, writeSnapshot, getSnapshotPath } from '../snapshot-manager';
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
});
