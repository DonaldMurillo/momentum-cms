import { describe, it, expect } from 'vitest';
import {
	computeSchemaChecksum,
	createSchemaSnapshot,
	serializeSnapshot,
	deserializeSnapshot,
	type TableSnapshot,
	INTERNAL_TABLES,
} from '../schema-snapshot';

describe('schema-snapshot', () => {
	const sampleTable: TableSnapshot = {
		name: 'posts',
		columns: [
			{ name: 'id', type: 'VARCHAR(36)', nullable: false, defaultValue: null, isPrimaryKey: true },
			{ name: 'title', type: 'TEXT', nullable: false, defaultValue: null, isPrimaryKey: false },
			{
				name: 'content',
				type: 'TEXT',
				nullable: true,
				defaultValue: null,
				isPrimaryKey: false,
			},
		],
		foreignKeys: [],
		indexes: [],
	};

	const sampleTableWithFk: TableSnapshot = {
		name: 'articles',
		columns: [
			{ name: 'id', type: 'VARCHAR(36)', nullable: false, defaultValue: null, isPrimaryKey: true },
			{
				name: 'category',
				type: 'VARCHAR(36)',
				nullable: true,
				defaultValue: null,
				isPrimaryKey: false,
			},
		],
		foreignKeys: [
			{
				constraintName: 'fk_articles_category',
				column: 'category',
				referencedTable: 'categories',
				referencedColumn: 'id',
				onDelete: 'SET NULL',
			},
		],
		indexes: [{ name: 'idx_articles_category', columns: ['category'], unique: false }],
	};

	describe('computeSchemaChecksum', () => {
		it('should produce a hex string', () => {
			const checksum = computeSchemaChecksum([sampleTable]);
			expect(checksum).toMatch(/^[a-f0-9]{64}$/);
		});

		it('should be deterministic for the same input', () => {
			const a = computeSchemaChecksum([sampleTable]);
			const b = computeSchemaChecksum([sampleTable]);
			expect(a).toBe(b);
		});

		it('should be order-independent for tables', () => {
			const a = computeSchemaChecksum([sampleTable, sampleTableWithFk]);
			const b = computeSchemaChecksum([sampleTableWithFk, sampleTable]);
			expect(a).toBe(b);
		});

		it('should be order-independent for columns within a table', () => {
			const reordered: TableSnapshot = {
				...sampleTable,
				columns: [...sampleTable.columns].reverse(),
			};
			const a = computeSchemaChecksum([sampleTable]);
			const b = computeSchemaChecksum([reordered]);
			expect(a).toBe(b);
		});

		it('should differ when tables differ', () => {
			const modified: TableSnapshot = {
				...sampleTable,
				columns: [
					...sampleTable.columns,
					{
						name: 'extra',
						type: 'TEXT',
						nullable: true,
						defaultValue: null,
						isPrimaryKey: false,
					},
				],
			};
			const a = computeSchemaChecksum([sampleTable]);
			const b = computeSchemaChecksum([modified]);
			expect(a).not.toBe(b);
		});

		it('should return a different checksum for empty vs non-empty', () => {
			const empty = computeSchemaChecksum([]);
			const nonEmpty = computeSchemaChecksum([sampleTable]);
			expect(empty).not.toBe(nonEmpty);
		});
	});

	describe('createSchemaSnapshot', () => {
		it('should create a snapshot with correct dialect', () => {
			const snapshot = createSchemaSnapshot('postgresql', [sampleTable]);
			expect(snapshot.dialect).toBe('postgresql');
			expect(snapshot.tables).toHaveLength(1);
			expect(snapshot.capturedAt).toBeTruthy();
			expect(snapshot.checksum).toMatch(/^[a-f0-9]{64}$/);
		});

		it('should include all tables', () => {
			const snapshot = createSchemaSnapshot('sqlite', [sampleTable, sampleTableWithFk]);
			expect(snapshot.tables).toHaveLength(2);
			expect(snapshot.tables.map((t) => t.name).sort()).toEqual(['articles', 'posts']);
		});

		it('should set capturedAt to a valid ISO timestamp', () => {
			const before = new Date().toISOString();
			const snapshot = createSchemaSnapshot('postgresql', []);
			const after = new Date().toISOString();
			expect(snapshot.capturedAt >= before).toBe(true);
			expect(snapshot.capturedAt <= after).toBe(true);
		});
	});

	describe('serialize / deserialize round-trip', () => {
		it('should round-trip a snapshot', () => {
			const original = createSchemaSnapshot('postgresql', [sampleTable, sampleTableWithFk]);
			const json = serializeSnapshot(original);
			const restored = deserializeSnapshot(json);

			expect(restored.dialect).toBe(original.dialect);
			expect(restored.checksum).toBe(original.checksum);
			expect(restored.capturedAt).toBe(original.capturedAt);
			expect(restored.tables).toHaveLength(original.tables.length);
			expect(restored.tables[0].name).toBe(original.tables[0].name);
		});

		it('should produce valid JSON', () => {
			const snapshot = createSchemaSnapshot('sqlite', [sampleTable]);
			const json = serializeSnapshot(snapshot);
			expect(() => JSON.parse(json)).not.toThrow();
		});

		it('should throw on invalid JSON', () => {
			expect(() => deserializeSnapshot('not json')).toThrow();
		});

		it('should throw on invalid snapshot structure', () => {
			expect(() => deserializeSnapshot('{"foo": "bar"}')).toThrow(
				'Invalid schema snapshot JSON',
			);
		});
	});

	describe('INTERNAL_TABLES', () => {
		it('should include migration tracking table', () => {
			expect(INTERNAL_TABLES.has('_momentum_migrations')).toBe(true);
		});

		it('should include seed tracking table', () => {
			expect(INTERNAL_TABLES.has('_momentum_seeds')).toBe(true);
		});

		it('should include globals table', () => {
			expect(INTERNAL_TABLES.has('_globals')).toBe(true);
		});

		it('should not include user tables', () => {
			expect(INTERNAL_TABLES.has('posts')).toBe(false);
		});
	});
});
