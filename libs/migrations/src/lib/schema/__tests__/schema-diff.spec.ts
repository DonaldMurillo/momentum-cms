import { describe, it, expect } from 'vitest';
import type {
	DatabaseSchemaSnapshot,
	TableSnapshot,
	ColumnSnapshot,
	ForeignKeySnapshot,
	IndexSnapshot,
} from '../schema-snapshot';
import { createSchemaSnapshot } from '../schema-snapshot';
import { diffSchemas } from '../schema-diff';
import type { MigrationOperation } from '../../operations/operation.types';

// ============================================
// Helpers
// ============================================

function makeSnapshot(tables: TableSnapshot[]): DatabaseSchemaSnapshot {
	return createSchemaSnapshot('postgresql', tables);
}

function col(
	name: string,
	type = 'TEXT',
	opts: Partial<ColumnSnapshot> = {},
): ColumnSnapshot {
	return {
		name,
		type,
		nullable: true,
		defaultValue: null,
		isPrimaryKey: false,
		...opts,
	};
}

function table(
	name: string,
	columns: ColumnSnapshot[],
	opts: { foreignKeys?: ForeignKeySnapshot[]; indexes?: IndexSnapshot[] } = {},
): TableSnapshot {
	return {
		name,
		columns,
		foreignKeys: opts.foreignKeys ?? [],
		indexes: opts.indexes ?? [],
	};
}

function findOps(ops: MigrationOperation[], type: string): MigrationOperation[] {
	return ops.filter((op) => op.type === type);
}

// ============================================
// Tests
// ============================================

describe('diffSchemas', () => {
	describe('identical schemas', () => {
		it('should report no changes for identical schemas', () => {
			const t = table('posts', [
				col('id', 'VARCHAR(36)', { isPrimaryKey: true, nullable: false }),
				col('title', 'TEXT', { nullable: false }),
			]);
			const desired = makeSnapshot([t]);
			const actual = makeSnapshot([t]);

			const result = diffSchemas(desired, actual, 'postgresql');

			expect(result.hasChanges).toBe(false);
			expect(result.operations).toHaveLength(0);
			expect(result.summary).toHaveLength(0);
		});
	});

	describe('table creation', () => {
		it('should detect new tables', () => {
			const desired = makeSnapshot([
				table('posts', [col('id', 'VARCHAR(36)'), col('title', 'TEXT')]),
			]);
			const actual = makeSnapshot([]);

			const result = diffSchemas(desired, actual, 'postgresql');

			expect(result.hasChanges).toBe(true);
			const createOps = findOps(result.operations, 'createTable');
			expect(createOps).toHaveLength(1);
			expect(createOps[0]).toMatchObject({
				type: 'createTable',
				table: 'posts',
			});
		});

		it('should include all columns in createTable operation', () => {
			const desired = makeSnapshot([
				table('posts', [
					col('id', 'VARCHAR(36)', { isPrimaryKey: true, nullable: false }),
					col('title', 'TEXT', { nullable: false }),
					col('body', 'TEXT'),
				]),
			]);
			const actual = makeSnapshot([]);

			const result = diffSchemas(desired, actual, 'postgresql');
			const createOp = result.operations[0];

			expect(createOp.type).toBe('createTable');
			if (createOp.type === 'createTable') {
				expect(createOp.columns).toHaveLength(3);
				expect(createOp.columns[0]).toMatchObject({
					name: 'id',
					type: 'VARCHAR(36)',
					nullable: false,
					primaryKey: true,
				});
			}
		});

		it('should add FKs and indexes for new tables', () => {
			const desired = makeSnapshot([
				table(
					'posts',
					[col('id', 'VARCHAR(36)'), col('author', 'VARCHAR(36)')],
					{
						foreignKeys: [
							{
								constraintName: 'fk_posts_author',
								column: 'author',
								referencedTable: 'users',
								referencedColumn: 'id',
								onDelete: 'SET NULL',
							},
						],
						indexes: [
							{ name: 'idx_posts_author', columns: ['author'], unique: false },
						],
					},
				),
			]);
			const actual = makeSnapshot([]);

			const result = diffSchemas(desired, actual, 'postgresql');

			const fkOps = findOps(result.operations, 'addForeignKey');
			expect(fkOps).toHaveLength(1);

			const idxOps = findOps(result.operations, 'createIndex');
			expect(idxOps).toHaveLength(1);
		});
	});

	describe('table dropping', () => {
		it('should detect dropped tables', () => {
			const desired = makeSnapshot([]);
			const actual = makeSnapshot([
				table('obsolete', [col('id', 'VARCHAR(36)')]),
			]);

			const result = diffSchemas(desired, actual, 'postgresql');

			expect(result.hasChanges).toBe(true);
			const dropOps = findOps(result.operations, 'dropTable');
			expect(dropOps).toHaveLength(1);
			expect(dropOps[0]).toMatchObject({
				type: 'dropTable',
				table: 'obsolete',
			});
		});
	});

	describe('column addition', () => {
		it('should detect new columns', () => {
			const desired = makeSnapshot([
				table('posts', [col('id', 'VARCHAR(36)'), col('title', 'TEXT'), col('body', 'TEXT')]),
			]);
			const actual = makeSnapshot([
				table('posts', [col('id', 'VARCHAR(36)'), col('title', 'TEXT')]),
			]);

			const result = diffSchemas(desired, actual, 'postgresql');

			expect(result.hasChanges).toBe(true);
			const addOps = findOps(result.operations, 'addColumn');
			expect(addOps).toHaveLength(1);
			expect(addOps[0]).toMatchObject({
				type: 'addColumn',
				table: 'posts',
				column: 'body',
				columnType: 'TEXT',
				nullable: true,
			});
		});
	});

	describe('column dropping', () => {
		it('should detect dropped columns', () => {
			const desired = makeSnapshot([
				table('posts', [col('id', 'VARCHAR(36)'), col('title', 'TEXT')]),
			]);
			const actual = makeSnapshot([
				table('posts', [
					col('id', 'VARCHAR(36)'),
					col('title', 'TEXT'),
					col('legacy', 'TEXT'),
				]),
			]);

			const result = diffSchemas(desired, actual, 'postgresql');

			const dropOps = findOps(result.operations, 'dropColumn');
			expect(dropOps).toHaveLength(1);
			expect(dropOps[0]).toMatchObject({
				type: 'dropColumn',
				table: 'posts',
				column: 'legacy',
			});
		});
	});

	describe('column type changes', () => {
		it('should detect type changes', () => {
			const desired = makeSnapshot([
				table('posts', [col('id', 'VARCHAR(36)'), col('rating', 'NUMERIC')]),
			]);
			const actual = makeSnapshot([
				table('posts', [col('id', 'VARCHAR(36)'), col('rating', 'TEXT')]),
			]);

			const result = diffSchemas(desired, actual, 'postgresql');

			const alterOps = findOps(result.operations, 'alterColumnType');
			expect(alterOps).toHaveLength(1);
			expect(alterOps[0]).toMatchObject({
				type: 'alterColumnType',
				table: 'posts',
				column: 'rating',
				fromType: 'TEXT',
				toType: 'NUMERIC',
			});
		});

		it('should NOT flag compatible types as changes', () => {
			const desired = makeSnapshot([
				table('posts', [
					col('id', 'VARCHAR(36)'),
					col('name', 'VARCHAR(255)'),
				]),
			]);
			const actual = makeSnapshot([
				table('posts', [
					col('id', 'VARCHAR(36)'),
					col('name', 'CHARACTER VARYING(255)'),
				]),
			]);

			const result = diffSchemas(desired, actual, 'postgresql');

			const alterOps = findOps(result.operations, 'alterColumnType');
			expect(alterOps).toHaveLength(0);
		});

		it('should normalize TIMESTAMP WITH TIME ZONE to TIMESTAMPTZ', () => {
			const desired = makeSnapshot([
				table('posts', [col('id', 'VARCHAR(36)'), col('created', 'TIMESTAMPTZ')]),
			]);
			const actual = makeSnapshot([
				table('posts', [
					col('id', 'VARCHAR(36)'),
					col('created', 'TIMESTAMP WITH TIME ZONE'),
				]),
			]);

			const result = diffSchemas(desired, actual, 'postgresql');
			expect(findOps(result.operations, 'alterColumnType')).toHaveLength(0);
		});
	});

	describe('nullable changes', () => {
		it('should detect nullable → required change', () => {
			const desired = makeSnapshot([
				table('posts', [
					col('id', 'VARCHAR(36)'),
					col('title', 'TEXT', { nullable: false }),
				]),
			]);
			const actual = makeSnapshot([
				table('posts', [
					col('id', 'VARCHAR(36)'),
					col('title', 'TEXT', { nullable: true }),
				]),
			]);

			const result = diffSchemas(desired, actual, 'postgresql');

			const nullOps = findOps(result.operations, 'alterColumnNullable');
			expect(nullOps).toHaveLength(1);
			expect(nullOps[0]).toMatchObject({
				type: 'alterColumnNullable',
				table: 'posts',
				column: 'title',
				nullable: false,
			});
		});

		it('should detect required → nullable change', () => {
			const desired = makeSnapshot([
				table('posts', [
					col('id', 'VARCHAR(36)'),
					col('title', 'TEXT', { nullable: true }),
				]),
			]);
			const actual = makeSnapshot([
				table('posts', [
					col('id', 'VARCHAR(36)'),
					col('title', 'TEXT', { nullable: false }),
				]),
			]);

			const result = diffSchemas(desired, actual, 'postgresql');

			const nullOps = findOps(result.operations, 'alterColumnNullable');
			expect(nullOps).toHaveLength(1);
			expect(nullOps[0]).toMatchObject({
				nullable: true,
			});
		});
	});

	describe('default value changes', () => {
		it('should detect added default', () => {
			const desired = makeSnapshot([
				table('posts', [
					col('id', 'VARCHAR(36)'),
					col('status', 'TEXT', { defaultValue: "'draft'" }),
				]),
			]);
			const actual = makeSnapshot([
				table('posts', [
					col('id', 'VARCHAR(36)'),
					col('status', 'TEXT', { defaultValue: null }),
				]),
			]);

			const result = diffSchemas(desired, actual, 'postgresql');

			const defOps = findOps(result.operations, 'alterColumnDefault');
			expect(defOps).toHaveLength(1);
			expect(defOps[0]).toMatchObject({
				type: 'alterColumnDefault',
				table: 'posts',
				column: 'status',
				defaultValue: "'draft'",
				previousDefault: null,
			});
		});

		it('should detect removed default', () => {
			const desired = makeSnapshot([
				table('posts', [col('status', 'TEXT', { defaultValue: null })]),
			]);
			const actual = makeSnapshot([
				table('posts', [col('status', 'TEXT', { defaultValue: "'draft'" })]),
			]);

			const result = diffSchemas(desired, actual, 'postgresql');

			const defOps = findOps(result.operations, 'alterColumnDefault');
			expect(defOps).toHaveLength(1);
		});
	});

	describe('rename detection', () => {
		it('should detect column renames when types match', () => {
			const desired = makeSnapshot([
				table('posts', [
					col('id', 'VARCHAR(36)'),
					col('full_name', 'TEXT'),
				]),
			]);
			const actual = makeSnapshot([
				table('posts', [
					col('id', 'VARCHAR(36)'),
					col('name', 'TEXT'),
				]),
			]);

			const result = diffSchemas(desired, actual, 'postgresql');

			const renameOps = findOps(result.operations, 'renameColumn');
			expect(renameOps).toHaveLength(1);
			expect(renameOps[0]).toMatchObject({
				type: 'renameColumn',
				table: 'posts',
				from: 'name',
				to: 'full_name',
			});
		});

		it('should NOT rename when types differ', () => {
			const desired = makeSnapshot([
				table('posts', [
					col('id', 'VARCHAR(36)'),
					col('full_name', 'NUMERIC'),
				]),
			]);
			const actual = makeSnapshot([
				table('posts', [
					col('id', 'VARCHAR(36)'),
					col('name', 'TEXT'),
				]),
			]);

			const result = diffSchemas(desired, actual, 'postgresql');

			const renameOps = findOps(result.operations, 'renameColumn');
			expect(renameOps).toHaveLength(0);

			// Should be drop + add instead
			expect(findOps(result.operations, 'addColumn')).toHaveLength(1);
			expect(findOps(result.operations, 'dropColumn')).toHaveLength(1);
		});

		it('should skip rename detection when disabled', () => {
			const desired = makeSnapshot([
				table('posts', [
					col('id', 'VARCHAR(36)'),
					col('full_name', 'TEXT'),
				]),
			]);
			const actual = makeSnapshot([
				table('posts', [
					col('id', 'VARCHAR(36)'),
					col('name', 'TEXT'),
				]),
			]);

			const result = diffSchemas(desired, actual, 'postgresql', {
				detectRenames: false,
			});

			expect(findOps(result.operations, 'renameColumn')).toHaveLength(0);
			expect(findOps(result.operations, 'addColumn')).toHaveLength(1);
			expect(findOps(result.operations, 'dropColumn')).toHaveLength(1);
		});

		it('should only consume each column once in rename detection', () => {
			// Two new columns, one old column — only one rename
			const desired = makeSnapshot([
				table('posts', [
					col('id', 'VARCHAR(36)'),
					col('display_name', 'TEXT'),
					col('screen_name', 'TEXT'),
				]),
			]);
			const actual = makeSnapshot([
				table('posts', [
					col('id', 'VARCHAR(36)'),
					col('name', 'TEXT'),
				]),
			]);

			const result = diffSchemas(desired, actual, 'postgresql');

			const renameOps = findOps(result.operations, 'renameColumn');
			const addOps = findOps(result.operations, 'addColumn');

			// One rename, one add (not two renames from same source)
			expect(renameOps).toHaveLength(1);
			expect(addOps).toHaveLength(1);
		});
	});

	describe('foreign key diffs', () => {
		it('should detect new foreign keys', () => {
			const desired = makeSnapshot([
				table('posts', [col('id', 'VARCHAR(36)'), col('author', 'VARCHAR(36)')], {
					foreignKeys: [
						{
							constraintName: 'fk_posts_author',
							column: 'author',
							referencedTable: 'users',
							referencedColumn: 'id',
							onDelete: 'SET NULL',
						},
					],
				}),
			]);
			const actual = makeSnapshot([
				table('posts', [col('id', 'VARCHAR(36)'), col('author', 'VARCHAR(36)')]),
			]);

			const result = diffSchemas(desired, actual, 'postgresql');

			const fkOps = findOps(result.operations, 'addForeignKey');
			expect(fkOps).toHaveLength(1);
			expect(fkOps[0]).toMatchObject({
				constraintName: 'fk_posts_author',
				column: 'author',
				referencedTable: 'users',
				onDelete: 'SET NULL',
			});
		});

		it('should detect dropped foreign keys', () => {
			const desired = makeSnapshot([
				table('posts', [col('id', 'VARCHAR(36)'), col('author', 'VARCHAR(36)')]),
			]);
			const actual = makeSnapshot([
				table('posts', [col('id', 'VARCHAR(36)'), col('author', 'VARCHAR(36)')], {
					foreignKeys: [
						{
							constraintName: 'fk_posts_author',
							column: 'author',
							referencedTable: 'users',
							referencedColumn: 'id',
							onDelete: 'SET NULL',
						},
					],
				}),
			]);

			const result = diffSchemas(desired, actual, 'postgresql');

			const dropFkOps = findOps(result.operations, 'dropForeignKey');
			expect(dropFkOps).toHaveLength(1);
		});

		it('should detect modified foreign keys (drop + re-add)', () => {
			const desired = makeSnapshot([
				table('posts', [col('id', 'VARCHAR(36)'), col('author', 'VARCHAR(36)')], {
					foreignKeys: [
						{
							constraintName: 'fk_posts_author',
							column: 'author',
							referencedTable: 'users',
							referencedColumn: 'id',
							onDelete: 'CASCADE',
						},
					],
				}),
			]);
			const actual = makeSnapshot([
				table('posts', [col('id', 'VARCHAR(36)'), col('author', 'VARCHAR(36)')], {
					foreignKeys: [
						{
							constraintName: 'fk_posts_author',
							column: 'author',
							referencedTable: 'users',
							referencedColumn: 'id',
							onDelete: 'SET NULL',
						},
					],
				}),
			]);

			const result = diffSchemas(desired, actual, 'postgresql');

			const dropOps = findOps(result.operations, 'dropForeignKey');
			const addOps = findOps(result.operations, 'addForeignKey');
			expect(dropOps).toHaveLength(1);
			expect(addOps).toHaveLength(1);
			if (addOps[0].type === 'addForeignKey') {
				expect(addOps[0].onDelete).toBe('CASCADE');
			}
		});
	});

	describe('index diffs', () => {
		it('should detect new indexes', () => {
			const desired = makeSnapshot([
				table('posts', [col('id', 'VARCHAR(36)'), col('email', 'TEXT')], {
					indexes: [{ name: 'idx_posts_email', columns: ['email'], unique: true }],
				}),
			]);
			const actual = makeSnapshot([
				table('posts', [col('id', 'VARCHAR(36)'), col('email', 'TEXT')]),
			]);

			const result = diffSchemas(desired, actual, 'postgresql');

			const idxOps = findOps(result.operations, 'createIndex');
			expect(idxOps).toHaveLength(1);
			expect(idxOps[0]).toMatchObject({
				indexName: 'idx_posts_email',
				columns: ['email'],
				unique: true,
			});
		});

		it('should detect dropped indexes', () => {
			const desired = makeSnapshot([
				table('posts', [col('id', 'VARCHAR(36)'), col('email', 'TEXT')]),
			]);
			const actual = makeSnapshot([
				table('posts', [col('id', 'VARCHAR(36)'), col('email', 'TEXT')], {
					indexes: [{ name: 'idx_posts_email', columns: ['email'], unique: true }],
				}),
			]);

			const result = diffSchemas(desired, actual, 'postgresql');

			const dropOps = findOps(result.operations, 'dropIndex');
			expect(dropOps).toHaveLength(1);
		});

		it('should detect modified indexes (uniqueness change)', () => {
			const desired = makeSnapshot([
				table('posts', [col('id', 'VARCHAR(36)'), col('email', 'TEXT')], {
					indexes: [{ name: 'idx_posts_email', columns: ['email'], unique: true }],
				}),
			]);
			const actual = makeSnapshot([
				table('posts', [col('id', 'VARCHAR(36)'), col('email', 'TEXT')], {
					indexes: [{ name: 'idx_posts_email', columns: ['email'], unique: false }],
				}),
			]);

			const result = diffSchemas(desired, actual, 'postgresql');

			// Should be drop + create
			const dropOps = findOps(result.operations, 'dropIndex');
			const createOps = findOps(result.operations, 'createIndex');
			expect(dropOps).toHaveLength(1);
			expect(createOps).toHaveLength(1);
		});

		it('should detect modified indexes (column change)', () => {
			const desired = makeSnapshot([
				table(
					'posts',
					[col('id', 'VARCHAR(36)'), col('email', 'TEXT'), col('name', 'TEXT')],
					{
						indexes: [
							{ name: 'idx_posts_compound', columns: ['email', 'name'], unique: false },
						],
					},
				),
			]);
			const actual = makeSnapshot([
				table(
					'posts',
					[col('id', 'VARCHAR(36)'), col('email', 'TEXT'), col('name', 'TEXT')],
					{
						indexes: [
							{ name: 'idx_posts_compound', columns: ['email'], unique: false },
						],
					},
				),
			]);

			const result = diffSchemas(desired, actual, 'postgresql');

			const dropOps = findOps(result.operations, 'dropIndex');
			const createOps = findOps(result.operations, 'createIndex');
			expect(dropOps).toHaveLength(1);
			expect(createOps).toHaveLength(1);
		});
	});

	describe('complex scenarios', () => {
		it('should handle multiple tables with mixed changes', () => {
			const desired = makeSnapshot([
				// posts: exists, column added
				table('posts', [
					col('id', 'VARCHAR(36)'),
					col('title', 'TEXT'),
					col('summary', 'TEXT'),
				]),
				// comments: new table
				table('comments', [
					col('id', 'VARCHAR(36)'),
					col('text', 'TEXT'),
				]),
			]);
			const actual = makeSnapshot([
				// posts: exists, will get new column
				table('posts', [col('id', 'VARCHAR(36)'), col('title', 'TEXT')]),
				// tags: will be dropped
				table('tags', [col('id', 'VARCHAR(36)'), col('name', 'TEXT')]),
			]);

			const result = diffSchemas(desired, actual, 'postgresql');

			expect(result.hasChanges).toBe(true);
			expect(findOps(result.operations, 'createTable')).toHaveLength(1); // comments
			expect(findOps(result.operations, 'dropTable')).toHaveLength(1); // tags
			expect(findOps(result.operations, 'addColumn')).toHaveLength(1); // summary
		});

		it('should handle a table with type + nullable + default changes on same column', () => {
			const desired = makeSnapshot([
				table('posts', [
					col('id', 'VARCHAR(36)'),
					col('score', 'NUMERIC', { nullable: false, defaultValue: '0' }),
				]),
			]);
			const actual = makeSnapshot([
				table('posts', [
					col('id', 'VARCHAR(36)'),
					col('score', 'TEXT', { nullable: true, defaultValue: null }),
				]),
			]);

			const result = diffSchemas(desired, actual, 'postgresql');

			expect(findOps(result.operations, 'alterColumnType')).toHaveLength(1);
			expect(findOps(result.operations, 'alterColumnNullable')).toHaveLength(1);
			expect(findOps(result.operations, 'alterColumnDefault')).toHaveLength(1);
		});
	});

	describe('summary', () => {
		it('should generate human-readable summary entries', () => {
			const desired = makeSnapshot([
				table('posts', [col('id', 'VARCHAR(36)'), col('title', 'TEXT')]),
			]);
			const actual = makeSnapshot([]);

			const result = diffSchemas(desired, actual, 'postgresql');

			expect(result.summary.length).toBeGreaterThan(0);
			expect(result.summary[0]).toBe('Create table "posts"');
		});
	});

	describe('SQLite dialect', () => {
		it('should normalize SQLite types correctly in diff', () => {
			const desired = makeSnapshot([
				table('posts', [col('id', 'TEXT'), col('count', 'INTEGER')]),
			]);
			const actual = makeSnapshot([
				table('posts', [col('id', 'TEXT'), col('count', 'INT')]),
			]);

			const result = diffSchemas(desired, actual, 'sqlite');

			// INT and INTEGER are compatible in SQLite
			expect(findOps(result.operations, 'alterColumnType')).toHaveLength(0);
		});
	});
});
