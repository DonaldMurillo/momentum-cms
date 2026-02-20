/**
 * Collections-to-Schema Mapper
 *
 * Converts Momentum CMS collection configs into a DatabaseSchemaSnapshot.
 * This represents the "desired" state that the diff engine compares
 * against the "actual" state from introspection.
 */
import type { CollectionConfig, Field } from '@momentumcms/core';
import { flattenDataFields, getSoftDeleteField } from '@momentumcms/core';
import type {
	ColumnSnapshot,
	ForeignKeySnapshot,
	IndexSnapshot,
	TableSnapshot,
	DatabaseSchemaSnapshot,
} from './schema-snapshot';
import { createSchemaSnapshot } from './schema-snapshot';
import type { DatabaseDialect } from './column-type-map';
import { fieldToColumnType } from './column-type-map';

/**
 * Map an OnDeleteAction to its SQL equivalent.
 */
function mapOnDelete(
	onDelete: 'set-null' | 'restrict' | 'cascade' | undefined,
	required: boolean,
): string {
	const effective =
		required && (!onDelete || onDelete === 'set-null') ? 'restrict' : onDelete;
	switch (effective) {
		case 'restrict':
			return 'RESTRICT';
		case 'cascade':
			return 'CASCADE';
		default:
			return 'SET NULL';
	}
}

/**
 * Resolve the table name for a collection.
 */
function getTableName(collection: CollectionConfig): string {
	return collection.dbName ?? collection.slug;
}

/**
 * Check if a collection has versioning with drafts enabled.
 */
function hasVersionDrafts(collection: CollectionConfig): boolean {
	const versions = collection.versions;
	if (!versions) return false;
	if (typeof versions === 'boolean') return false;
	return !!versions.drafts;
}

/**
 * Type guard for CollectionConfig-like objects.
 */
function isCollectionConfig(value: unknown): value is CollectionConfig {
	return (
		typeof value === 'object' &&
		value !== null &&
		'slug' in value &&
		'fields' in value
	);
}

/**
 * Resolve the target collection config from a lazy relationship reference.
 * Returns null if resolution fails.
 */
function resolveCollectionRef(ref: () => unknown): CollectionConfig | null {
	try {
		const resolved: unknown = ref();
		if (isCollectionConfig(resolved)) {
			return resolved;
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Build auto-generated columns that every collection table has.
 */
function buildAutoColumns(
	collection: CollectionConfig,
	dialect: DatabaseDialect,
): ColumnSnapshot[] {
	const columns: ColumnSnapshot[] = [];

	// id column — always present
	columns.push({
		name: 'id',
		type: dialect === 'postgresql' ? 'VARCHAR(36)' : 'TEXT',
		nullable: false,
		defaultValue: null,
		isPrimaryKey: true,
	});

	// Timestamps (default: true)
	const timestamps = collection.timestamps;
	const addCreatedAt = timestamps !== false && (timestamps === true || timestamps === undefined || timestamps.createdAt !== false);
	const addUpdatedAt = timestamps !== false && (timestamps === true || timestamps === undefined || timestamps.updatedAt !== false);

	if (addCreatedAt) {
		columns.push({
			name: 'createdAt',
			type: dialect === 'postgresql' ? 'TIMESTAMPTZ' : 'TEXT',
			nullable: false,
			defaultValue: null,
			isPrimaryKey: false,
		});
	}

	if (addUpdatedAt) {
		columns.push({
			name: 'updatedAt',
			type: dialect === 'postgresql' ? 'TIMESTAMPTZ' : 'TEXT',
			nullable: false,
			defaultValue: null,
			isPrimaryKey: false,
		});
	}

	// _status column for versioned collections with drafts
	if (hasVersionDrafts(collection)) {
		columns.push({
			name: '_status',
			type: dialect === 'postgresql' ? 'VARCHAR(20)' : 'TEXT',
			nullable: false,
			defaultValue: "'draft'",
			isPrimaryKey: false,
		});
	}

	// Soft delete column
	const softDeleteCol = getSoftDeleteField(collection);
	if (softDeleteCol) {
		columns.push({
			name: softDeleteCol,
			type: dialect === 'postgresql' ? 'TIMESTAMPTZ' : 'TEXT',
			nullable: true,
			defaultValue: null,
			isPrimaryKey: false,
		});
	}

	return columns;
}

/**
 * Build a column snapshot from a Momentum field.
 */
function fieldToColumn(field: Field, dialect: DatabaseDialect): ColumnSnapshot {
	return {
		name: field.name,
		type: fieldToColumnType(field, dialect),
		nullable: !field.required,
		defaultValue: null,
		isPrimaryKey: false,
	};
}

/**
 * Build foreign key snapshots from relationship fields.
 */
function buildForeignKeys(
	tableName: string,
	fields: Field[],
): ForeignKeySnapshot[] {
	const foreignKeys: ForeignKeySnapshot[] = [];

	for (const field of fields) {
		if (field.type !== 'relationship') continue;

		// Skip hasMany (stored as JSON array, no FK)
		if (field.hasMany) continue;

		// Skip polymorphic relationships (no FK)
		if (field.relationTo && field.relationTo.length > 0) continue;

		// Resolve the target collection
		const target = resolveCollectionRef(field.collection);
		if (!target) continue;

		const targetTable = getTableName(target);
		const onDelete = mapOnDelete(field.onDelete, !!field.required);

		foreignKeys.push({
			constraintName: `fk_${tableName}_${field.name}`,
			column: field.name,
			referencedTable: targetTable,
			referencedColumn: 'id',
			onDelete,
		});
	}

	return foreignKeys;
}

/**
 * Build index snapshots from collection config.
 */
function buildIndexes(
	tableName: string,
	collection: CollectionConfig,
): IndexSnapshot[] {
	const indexes: IndexSnapshot[] = [];

	// Soft-delete field index
	const sdField = getSoftDeleteField(collection);
	if (sdField) {
		indexes.push({
			name: `idx_${tableName}_${sdField}`,
			columns: [sdField],
			unique: false,
		});
	}

	// Explicit indexes from collection config
	if (collection.indexes) {
		for (const idx of collection.indexes) {
			indexes.push({
				name: idx.name ?? `idx_${tableName}_${idx.columns.join('_')}`,
				columns: [...idx.columns],
				unique: !!idx.unique,
			});
		}
	}

	return indexes;
}

/**
 * Build a versions table snapshot for collections with versioning enabled.
 */
function buildVersionTable(
	collection: CollectionConfig,
	dialect: DatabaseDialect,
): TableSnapshot | null {
	if (!collection.versions) return null;

	const baseTable = getTableName(collection);
	const tableName = `${baseTable}_versions`;

	const columns: ColumnSnapshot[] = [
		{
			name: 'id',
			type: dialect === 'postgresql' ? 'VARCHAR(36)' : 'TEXT',
			nullable: false,
			defaultValue: null,
			isPrimaryKey: true,
		},
		{
			name: 'parent',
			type: dialect === 'postgresql' ? 'VARCHAR(36)' : 'TEXT',
			nullable: false,
			defaultValue: null,
			isPrimaryKey: false,
		},
		{
			name: 'version',
			type: 'TEXT',
			nullable: false,
			defaultValue: null,
			isPrimaryKey: false,
		},
		{
			name: '_status',
			type: dialect === 'postgresql' ? 'VARCHAR(20)' : 'TEXT',
			nullable: false,
			defaultValue: "'draft'",
			isPrimaryKey: false,
		},
		{
			name: 'autosave',
			type: dialect === 'postgresql' ? 'BOOLEAN' : 'INTEGER',
			nullable: false,
			defaultValue: dialect === 'postgresql' ? 'false' : '0',
			isPrimaryKey: false,
		},
		{
			name: 'publishedAt',
			type: dialect === 'postgresql' ? 'TIMESTAMPTZ' : 'TEXT',
			nullable: true,
			defaultValue: null,
			isPrimaryKey: false,
		},
		{
			name: 'createdAt',
			type: dialect === 'postgresql' ? 'TIMESTAMPTZ' : 'TEXT',
			nullable: false,
			defaultValue: null,
			isPrimaryKey: false,
		},
		{
			name: 'updatedAt',
			type: dialect === 'postgresql' ? 'TIMESTAMPTZ' : 'TEXT',
			nullable: false,
			defaultValue: null,
			isPrimaryKey: false,
		},
	];

	const foreignKeys: ForeignKeySnapshot[] = [
		{
			constraintName: `fk_${tableName}_parent`,
			column: 'parent',
			referencedTable: baseTable,
			referencedColumn: 'id',
			onDelete: 'CASCADE',
		},
	];

	const indexes: IndexSnapshot[] = [
		{ name: `idx_${tableName}_parent`, columns: ['parent'], unique: false },
		{ name: `idx_${tableName}_status`, columns: ['_status'], unique: false },
		{ name: `idx_${tableName}_createdAt`, columns: ['createdAt'], unique: false },
	];

	return { name: tableName, columns, foreignKeys, indexes };
}

/**
 * Convert a single collection config to a TableSnapshot.
 */
export function collectionToTableSnapshot(
	collection: CollectionConfig,
	dialect: DatabaseDialect,
): TableSnapshot {
	const tableName = getTableName(collection);
	const dataFields = flattenDataFields(collection.fields);

	const columns = [
		...buildAutoColumns(collection, dialect),
		...dataFields.map((f) => fieldToColumn(f, dialect)),
	];

	const foreignKeys = buildForeignKeys(tableName, dataFields);
	const indexes = buildIndexes(tableName, collection);

	return { name: tableName, columns, foreignKeys, indexes };
}

/**
 * Convert an array of collection configs to a full DatabaseSchemaSnapshot.
 * This is the "desired" schema that the diff engine compares against.
 */
export function collectionsToSchema(
	collections: CollectionConfig[],
	dialect: DatabaseDialect,
): DatabaseSchemaSnapshot {
	const tables: TableSnapshot[] = [];

	for (const collection of collections) {
		tables.push(collectionToTableSnapshot(collection, dialect));

		// Add version tables
		const versionTable = buildVersionTable(collection, dialect);
		if (versionTable) {
			tables.push(versionTable);
		}
	}

	return createSchemaSnapshot(dialect, tables);
}
