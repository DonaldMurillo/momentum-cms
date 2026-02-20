import { describe, it, expect } from 'vitest';
import {
	defineCollection,
	text,
	number,
	checkbox,
	date,
	select,
	richText,
	relationship,
	email,
	json,
	group,
	array,
	blocks,
	slug,
	upload,
	tabs,
	collapsible,
	row,
} from '@momentumcms/core';
import { collectionToTableSnapshot, collectionsToSchema } from '../collections-to-schema';

// ============================================
// Helper collections
// ============================================

const SimpleCollection = defineCollection({
	slug: 'posts',
	fields: [text('title', { required: true }), text('body')],
});

const CollectionWithAllFieldTypes = defineCollection({
	slug: 'kitchen-sink',
	fields: [
		text('textField'),
		number('numberField'),
		checkbox('checkboxField'),
		date('dateField'),
		select('selectField', { options: ['a', 'b'] }),
		richText('richTextField'),
		email('emailField'),
		json('jsonField'),
		group('groupField', { fields: [text('nested')] }),
		array('arrayField', { fields: [text('item')] }),
		blocks('blocksField', { blocks: [{ slug: 'hero', fields: [text('heading')] }] }),
		slug('slugField', { from: 'textField' }),
		upload('uploadField', { relationTo: 'media' }),
	],
});

const ParentCollection = defineCollection({
	slug: 'parents',
	fields: [text('name', { required: true })],
});

const ChildCollection = defineCollection({
	slug: 'children',
	fields: [
		text('label', { required: true }),
		relationship('parent', { collection: () => ParentCollection }),
	],
});

const RequiredRelCollection = defineCollection({
	slug: 'required-rel',
	fields: [
		text('name'),
		relationship('owner', { collection: () => ParentCollection, required: true }),
	],
});

const CascadeRelCollection = defineCollection({
	slug: 'cascade-rel',
	fields: [
		text('data'),
		relationship('parent', {
			collection: () => ParentCollection,
			onDelete: 'cascade',
		}),
	],
});

const HasManyRelCollection = defineCollection({
	slug: 'has-many-rel',
	fields: [
		text('name'),
		relationship('tags', { collection: () => ParentCollection, hasMany: true }),
	],
});

const VersionedCollection = defineCollection({
	slug: 'articles',
	fields: [text('title', { required: true }), richText('content')],
	versions: { drafts: true },
});

const SoftDeleteCollection = defineCollection({
	slug: 'items',
	fields: [text('name')],
	softDelete: true,
});

const CustomSoftDeleteCollection = defineCollection({
	slug: 'archive-items',
	fields: [text('name')],
	softDelete: { field: 'archivedAt' },
});

const IndexedCollection = defineCollection({
	slug: 'indexed',
	fields: [text('email'), text('slug')],
	indexes: [
		{ columns: ['email'], unique: true },
		{ columns: ['slug'], unique: false, name: 'idx_custom_slug' },
	],
});

const DbNameCollection = defineCollection({
	slug: 'my-items',
	dbName: 'custom_items_table',
	fields: [text('name')],
});

const LayoutFieldsCollection = defineCollection({
	slug: 'with-layout',
	fields: [
		text('title', { required: true }),
		tabs('mainTabs', {
			tabs: [
				{ label: 'Content', fields: [richText('body')] },
				{ name: 'meta', label: 'Meta', fields: [text('metaTitle')] },
			],
		}),
		collapsible('settings', {
			fields: [checkbox('published')],
		}),
		row('inline', { fields: [text('left'), text('right')] }),
	],
});

// ============================================
// Tests
// ============================================

describe('collectionToTableSnapshot', () => {
	describe('auto-generated columns', () => {
		it('should include id, createdAt, updatedAt for a simple collection', () => {
			const table = collectionToTableSnapshot(SimpleCollection, 'postgresql');

			const idCol = table.columns.find((c) => c.name === 'id');
			expect(idCol).toEqual({
				name: 'id',
				type: 'VARCHAR(36)',
				nullable: false,
				defaultValue: null,
				isPrimaryKey: true,
			});

			const createdAt = table.columns.find((c) => c.name === 'createdAt');
			expect(createdAt).toEqual({
				name: 'createdAt',
				type: 'TIMESTAMPTZ',
				nullable: false,
				defaultValue: null,
				isPrimaryKey: false,
			});

			const updatedAt = table.columns.find((c) => c.name === 'updatedAt');
			expect(updatedAt).toEqual({
				name: 'updatedAt',
				type: 'TIMESTAMPTZ',
				nullable: false,
				defaultValue: null,
				isPrimaryKey: false,
			});
		});

		it('should use TEXT types for SQLite auto-columns', () => {
			const table = collectionToTableSnapshot(SimpleCollection, 'sqlite');

			expect(table.columns.find((c) => c.name === 'id')?.type).toBe('TEXT');
			expect(table.columns.find((c) => c.name === 'createdAt')?.type).toBe('TEXT');
			expect(table.columns.find((c) => c.name === 'updatedAt')?.type).toBe('TEXT');
		});

		it('should add _status column for versioned collections with drafts', () => {
			const table = collectionToTableSnapshot(VersionedCollection, 'postgresql');
			const statusCol = table.columns.find((c) => c.name === '_status');

			expect(statusCol).toEqual({
				name: '_status',
				type: 'VARCHAR(20)',
				nullable: false,
				defaultValue: "'draft'",
				isPrimaryKey: false,
			});
		});

		it('should NOT add _status column for non-versioned collections', () => {
			const table = collectionToTableSnapshot(SimpleCollection, 'postgresql');
			expect(table.columns.find((c) => c.name === '_status')).toBeUndefined();
		});

		it('should add soft-delete column when softDelete is true', () => {
			const table = collectionToTableSnapshot(SoftDeleteCollection, 'postgresql');
			const sdCol = table.columns.find((c) => c.name === 'deletedAt');

			expect(sdCol).toEqual({
				name: 'deletedAt',
				type: 'TIMESTAMPTZ',
				nullable: true,
				defaultValue: null,
				isPrimaryKey: false,
			});
		});

		it('should use custom soft-delete field name', () => {
			const table = collectionToTableSnapshot(CustomSoftDeleteCollection, 'postgresql');
			expect(table.columns.find((c) => c.name === 'archivedAt')).toBeDefined();
			expect(table.columns.find((c) => c.name === 'deletedAt')).toBeUndefined();
		});
	});

	describe('field type mapping (PostgreSQL)', () => {
		it('should map all field types correctly for postgresql', () => {
			const table = collectionToTableSnapshot(CollectionWithAllFieldTypes, 'postgresql');
			const colMap = new Map(table.columns.map((c) => [c.name, c]));

			expect(colMap.get('textField')?.type).toBe('TEXT');
			expect(colMap.get('numberField')?.type).toBe('NUMERIC');
			expect(colMap.get('checkboxField')?.type).toBe('BOOLEAN');
			expect(colMap.get('dateField')?.type).toBe('TIMESTAMPTZ');
			expect(colMap.get('selectField')?.type).toBe('VARCHAR(255)');
			expect(colMap.get('richTextField')?.type).toBe('TEXT');
			expect(colMap.get('emailField')?.type).toBe('VARCHAR(255)');
			expect(colMap.get('jsonField')?.type).toBe('JSONB');
			expect(colMap.get('groupField')?.type).toBe('JSONB');
			expect(colMap.get('arrayField')?.type).toBe('JSONB');
			expect(colMap.get('blocksField')?.type).toBe('JSONB');
			expect(colMap.get('slugField')?.type).toBe('VARCHAR(255)');
			expect(colMap.get('uploadField')?.type).toBe('VARCHAR(36)');
		});
	});

	describe('field type mapping (SQLite)', () => {
		it('should map all field types correctly for sqlite', () => {
			const table = collectionToTableSnapshot(CollectionWithAllFieldTypes, 'sqlite');
			const colMap = new Map(table.columns.map((c) => [c.name, c]));

			expect(colMap.get('textField')?.type).toBe('TEXT');
			expect(colMap.get('numberField')?.type).toBe('REAL');
			expect(colMap.get('checkboxField')?.type).toBe('INTEGER');
			expect(colMap.get('dateField')?.type).toBe('TEXT');
			expect(colMap.get('selectField')?.type).toBe('TEXT');
			expect(colMap.get('jsonField')?.type).toBe('TEXT');
			expect(colMap.get('groupField')?.type).toBe('TEXT');
			expect(colMap.get('uploadField')?.type).toBe('TEXT');
		});
	});

	describe('nullable (required) mapping', () => {
		it('should mark required fields as not nullable', () => {
			const table = collectionToTableSnapshot(SimpleCollection, 'postgresql');
			const title = table.columns.find((c) => c.name === 'title');
			const body = table.columns.find((c) => c.name === 'body');

			expect(title?.nullable).toBe(false);
			expect(body?.nullable).toBe(true);
		});
	});

	describe('table naming', () => {
		it('should use slug as table name by default', () => {
			const table = collectionToTableSnapshot(SimpleCollection, 'postgresql');
			expect(table.name).toBe('posts');
		});

		it('should use dbName when specified', () => {
			const table = collectionToTableSnapshot(DbNameCollection, 'postgresql');
			expect(table.name).toBe('custom_items_table');
		});
	});

	describe('layout field flattening', () => {
		it('should flatten layout fields and hoist children', () => {
			const table = collectionToTableSnapshot(LayoutFieldsCollection, 'postgresql');
			const colNames = table.columns.map((c) => c.name);

			// title — direct field
			expect(colNames).toContain('title');
			// body — from unnamed tab, hoisted
			expect(colNames).toContain('body');
			// meta — named tab, becomes group (JSONB)
			expect(colNames).toContain('meta');
			// published — from collapsible, hoisted
			expect(colNames).toContain('published');
			// left, right — from row, hoisted
			expect(colNames).toContain('left');
			expect(colNames).toContain('right');

			// Layout fields themselves should NOT appear as columns
			expect(colNames).not.toContain('mainTabs');
			expect(colNames).not.toContain('settings');
			expect(colNames).not.toContain('inline');
		});

		it('should map named tabs as group (JSONB)', () => {
			const table = collectionToTableSnapshot(LayoutFieldsCollection, 'postgresql');
			const meta = table.columns.find((c) => c.name === 'meta');
			expect(meta?.type).toBe('JSONB');
		});
	});

	describe('foreign keys', () => {
		it('should create FK for single relationship fields', () => {
			const table = collectionToTableSnapshot(ChildCollection, 'postgresql');
			expect(table.foreignKeys).toHaveLength(1);
			expect(table.foreignKeys[0]).toEqual({
				constraintName: 'fk_children_parent',
				column: 'parent',
				referencedTable: 'parents',
				referencedColumn: 'id',
				onDelete: 'SET NULL',
			});
		});

		it('should use RESTRICT for required relationships with default onDelete', () => {
			const table = collectionToTableSnapshot(RequiredRelCollection, 'postgresql');
			expect(table.foreignKeys[0]?.onDelete).toBe('RESTRICT');
		});

		it('should use CASCADE when onDelete is cascade', () => {
			const table = collectionToTableSnapshot(CascadeRelCollection, 'postgresql');
			expect(table.foreignKeys[0]?.onDelete).toBe('CASCADE');
		});

		it('should NOT create FK for hasMany relationships', () => {
			const table = collectionToTableSnapshot(HasManyRelCollection, 'postgresql');
			expect(table.foreignKeys).toHaveLength(0);
		});
	});

	describe('indexes', () => {
		it('should create indexes from collection.indexes', () => {
			const table = collectionToTableSnapshot(IndexedCollection, 'postgresql');

			expect(table.indexes).toContainEqual({
				name: 'idx_indexed_email',
				columns: ['email'],
				unique: true,
			});

			expect(table.indexes).toContainEqual({
				name: 'idx_custom_slug',
				columns: ['slug'],
				unique: false,
			});
		});

		it('should create soft-delete index', () => {
			const table = collectionToTableSnapshot(SoftDeleteCollection, 'postgresql');
			expect(table.indexes).toContainEqual({
				name: 'idx_items_deletedAt',
				columns: ['deletedAt'],
				unique: false,
			});
		});
	});
});

describe('collectionsToSchema', () => {
	it('should produce a valid snapshot with all collections', () => {
		const schema = collectionsToSchema(
			[SimpleCollection, ChildCollection],
			'postgresql',
		);

		expect(schema.dialect).toBe('postgresql');
		expect(schema.tables).toHaveLength(2);
		expect(schema.tables.map((t) => t.name).sort()).toEqual(['children', 'posts']);
		expect(schema.checksum).toBeTruthy();
		expect(schema.capturedAt).toBeTruthy();
	});

	it('should include version tables for versioned collections', () => {
		const schema = collectionsToSchema([VersionedCollection], 'postgresql');

		expect(schema.tables).toHaveLength(2);
		expect(schema.tables.map((t) => t.name).sort()).toEqual([
			'articles',
			'articles_versions',
		]);
	});

	it('should build correct version table structure', () => {
		const schema = collectionsToSchema([VersionedCollection], 'postgresql');
		const versionTable = schema.tables.find((t) => t.name === 'articles_versions');

		expect(versionTable).toBeDefined();
		const colNames = versionTable!.columns.map((c) => c.name);
		expect(colNames).toEqual([
			'id',
			'parent',
			'version',
			'_status',
			'autosave',
			'publishedAt',
			'createdAt',
			'updatedAt',
		]);

		// FK to parent table
		expect(versionTable!.foreignKeys).toHaveLength(1);
		expect(versionTable!.foreignKeys[0]).toEqual({
			constraintName: 'fk_articles_versions_parent',
			column: 'parent',
			referencedTable: 'articles',
			referencedColumn: 'id',
			onDelete: 'CASCADE',
		});

		// Indexes
		expect(versionTable!.indexes).toHaveLength(3);
	});

	it('should NOT include version tables for non-versioned collections', () => {
		const schema = collectionsToSchema([SimpleCollection], 'postgresql');
		expect(schema.tables).toHaveLength(1);
	});

	it('should produce different checksums for different schemas', () => {
		const schema1 = collectionsToSchema([SimpleCollection], 'postgresql');
		const schema2 = collectionsToSchema(
			[SimpleCollection, ChildCollection],
			'postgresql',
		);
		expect(schema1.checksum).not.toBe(schema2.checksum);
	});
});
