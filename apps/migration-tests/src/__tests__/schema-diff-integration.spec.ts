/**
 * Integration tests for the schema diff pipeline.
 *
 * Tests the full flow: collection configs → schema snapshot → diff → operations.
 * Uses real collections from the shared example-config and test-specific mutations.
 */
import { describe, it, expect } from 'vitest';
import {
	SimpleBeforeCollection,
	SimpleAfterCollection,
	RelTestParent,
	RelTestChild,
} from '../helpers/test-collections';
import {
	collectionsToSchema,
	diffSchemas,
	collectionToTableSnapshot,
} from '@momentumcms/migrations';
import type { MigrationOperation } from '@momentumcms/migrations';
import { defineCollection, text, number, checkbox, select, relationship } from '@momentumcms/core';

function findOps(ops: MigrationOperation[], type: string): MigrationOperation[] {
	return ops.filter((op) => op.type === type);
}

describe('schema diff integration', () => {
	describe('simple collection mutation', () => {
		it('should detect field additions, removals, and nullable changes', () => {
			const before = collectionsToSchema([SimpleBeforeCollection], 'postgresql');
			const after = collectionsToSchema([SimpleAfterCollection], 'postgresql');

			const result = diffSchemas(after, before, 'postgresql');

			expect(result.hasChanges).toBe(true);

			// 'status' was added (select field → VARCHAR(255))
			const addOps = findOps(result.operations, 'addColumn');
			const addedStatus = addOps.find(
				(op) => op.type === 'addColumn' && op.column === 'status',
			);
			expect(addedStatus).toBeDefined();
			if (addedStatus?.type === 'addColumn') {
				expect(addedStatus.columnType).toBe('VARCHAR(255)');
			}

			// 'order' was removed — but rename detection may fire since
			// 'order' (NUMERIC) and 'status' (VARCHAR) have different types,
			// so it should be a clean drop
			const dropOps = findOps(result.operations, 'dropColumn');
			const droppedOrder = dropOps.find(
				(op) => op.type === 'dropColumn' && op.column === 'order',
			);
			expect(droppedOrder).toBeDefined();

			// 'description' changed from nullable to required
			const nullOps = findOps(result.operations, 'alterColumnNullable');
			const descNull = nullOps.find(
				(op) => op.type === 'alterColumnNullable' && op.column === 'description',
			);
			expect(descNull).toBeDefined();
			if (descNull?.type === 'alterColumnNullable') {
				expect(descNull.nullable).toBe(false);
			}
		});
	});

	describe('relationship collections', () => {
		it('should detect FK additions when adding a relationship field', () => {
			// Before: just parent table, no child
			const before = collectionsToSchema([RelTestParent], 'postgresql');
			// After: parent + child with FK
			const after = collectionsToSchema([RelTestParent, RelTestChild], 'postgresql');

			const result = diffSchemas(after, before, 'postgresql');

			expect(result.hasChanges).toBe(true);

			// New table 'rel-child' should be created
			const createOps = findOps(result.operations, 'createTable');
			expect(createOps.some((op) => op.type === 'createTable' && op.table === 'rel-child')).toBe(
				true,
			);

			// FK should be added for the child table
			const fkOps = findOps(result.operations, 'addForeignKey');
			const childFk = fkOps.find(
				(op) => op.type === 'addForeignKey' && op.table === 'rel-child',
			);
			expect(childFk).toBeDefined();
			if (childFk?.type === 'addForeignKey') {
				expect(childFk.column).toBe('parent');
				expect(childFk.referencedTable).toBe('rel-parent');
				expect(childFk.referencedColumn).toBe('id');
			}
		});
	});

	describe('adding a relationship to existing table', () => {
		it('should detect FK addition on existing table', () => {
			const CollBefore = defineCollection({
				slug: 'posts',
				fields: [text('title', { required: true })],
			});

			const CollAfter = defineCollection({
				slug: 'posts',
				fields: [
					text('title', { required: true }),
					relationship('author', { collection: () => RelTestParent }),
				],
			});

			const before = collectionsToSchema([RelTestParent, CollBefore], 'postgresql');
			const after = collectionsToSchema([RelTestParent, CollAfter], 'postgresql');

			const result = diffSchemas(after, before, 'postgresql');

			expect(result.hasChanges).toBe(true);

			// New column 'author' should be added
			const addOps = findOps(result.operations, 'addColumn');
			expect(addOps.some((op) => op.type === 'addColumn' && op.column === 'author')).toBe(true);

			// FK should be added for the posts table
			const fkOps = findOps(result.operations, 'addForeignKey');
			expect(
				fkOps.some((op) => op.type === 'addForeignKey' && op.constraintName === 'fk_posts_author'),
			).toBe(true);
		});
	});

	describe('versioning changes', () => {
		it('should detect version table addition', () => {
			const NonVersioned = defineCollection({
				slug: 'articles',
				fields: [text('title', { required: true })],
			});

			const Versioned = defineCollection({
				slug: 'articles',
				fields: [text('title', { required: true })],
				versions: { drafts: true },
			});

			const before = collectionsToSchema([NonVersioned], 'postgresql');
			const after = collectionsToSchema([Versioned], 'postgresql');

			const result = diffSchemas(after, before, 'postgresql');

			expect(result.hasChanges).toBe(true);

			// articles_versions table should be created
			const createOps = findOps(result.operations, 'createTable');
			expect(
				createOps.some(
					(op) => op.type === 'createTable' && op.table === 'articles_versions',
				),
			).toBe(true);

			// _status column should be added to main table
			const addOps = findOps(result.operations, 'addColumn');
			expect(
				addOps.some((op) => op.type === 'addColumn' && op.column === '_status'),
			).toBe(true);
		});
	});

	describe('soft delete changes', () => {
		it('should detect soft-delete column and index addition', () => {
			const Before = defineCollection({
				slug: 'items',
				fields: [text('name')],
			});

			const After = defineCollection({
				slug: 'items',
				fields: [text('name')],
				softDelete: true,
			});

			const before = collectionsToSchema([Before], 'postgresql');
			const after = collectionsToSchema([After], 'postgresql');

			const result = diffSchemas(after, before, 'postgresql');

			expect(result.hasChanges).toBe(true);

			// deletedAt column added
			const addOps = findOps(result.operations, 'addColumn');
			expect(
				addOps.some((op) => op.type === 'addColumn' && op.column === 'deletedAt'),
			).toBe(true);

			// Index on deletedAt added
			const idxOps = findOps(result.operations, 'createIndex');
			expect(
				idxOps.some(
					(op) => op.type === 'createIndex' && op.indexName === 'idx_items_deletedAt',
				),
			).toBe(true);
		});
	});

	describe('no-op diff', () => {
		it('should report no changes when collections are unchanged', () => {
			const schema = collectionsToSchema(
				[RelTestParent, RelTestChild],
				'postgresql',
			);

			const result = diffSchemas(schema, schema, 'postgresql');

			expect(result.hasChanges).toBe(false);
			expect(result.operations).toHaveLength(0);
		});
	});

	describe('rename heuristic with collection changes', () => {
		it('should detect likely rename when field name changes but type stays same', () => {
			const Before = defineCollection({
				slug: 'products',
				fields: [text('name'), number('price')],
			});

			const After = defineCollection({
				slug: 'products',
				fields: [text('title'), number('price')],
			});

			const before = collectionsToSchema([Before], 'postgresql');
			const after = collectionsToSchema([After], 'postgresql');

			const result = diffSchemas(after, before, 'postgresql');

			const renameOps = findOps(result.operations, 'renameColumn');
			expect(renameOps).toHaveLength(1);
			if (renameOps[0].type === 'renameColumn') {
				expect(renameOps[0].from).toBe('name');
				expect(renameOps[0].to).toBe('title');
			}
		});
	});

	describe('SQLite dialect', () => {
		it('should produce correct types for SQLite', () => {
			const table = collectionToTableSnapshot(SimpleBeforeCollection, 'sqlite');

			const colMap = new Map(table.columns.map((c) => [c.name, c]));
			expect(colMap.get('id')?.type).toBe('TEXT');
			expect(colMap.get('title')?.type).toBe('TEXT');
			expect(colMap.get('order')?.type).toBe('REAL');
		});
	});
});
