import { describe, it, expect } from 'vitest';
import type { MigrationOperation } from '../../operations/operation.types';
import {
	operationToSql,
	operationToReverseSql,
	operationsToUpSql,
	operationsToDownSql,
} from '../sql-generator';

describe('sql-generator', () => {
	describe('operationToSql', () => {
		describe('createTable', () => {
			it('should generate CREATE TABLE with all column defs', () => {
				const op: MigrationOperation = {
					type: 'createTable',
					table: 'posts',
					columns: [
						{ name: 'id', type: 'VARCHAR(36)', nullable: false, primaryKey: true },
						{ name: 'title', type: 'TEXT', nullable: false },
						{ name: 'body', type: 'TEXT', nullable: true },
						{ name: 'status', type: 'TEXT', nullable: false, defaultValue: "'draft'" },
					],
				};
				const sql = operationToSql(op, 'postgresql');

				expect(sql).toContain('CREATE TABLE "posts"');
				expect(sql).toContain('"id" VARCHAR(36) PRIMARY KEY NOT NULL');
				expect(sql).toContain('"title" TEXT NOT NULL');
				expect(sql).toContain('"body" TEXT');
				expect(sql).toContain('"status" TEXT NOT NULL DEFAULT \'draft\'');
			});
		});

		describe('dropTable', () => {
			it('should generate DROP TABLE', () => {
				const sql = operationToSql({ type: 'dropTable', table: 'old_table' }, 'postgresql');
				expect(sql).toBe('DROP TABLE IF EXISTS "old_table"');
			});
		});

		describe('renameTable', () => {
			it('should generate ALTER TABLE RENAME', () => {
				const sql = operationToSql(
					{ type: 'renameTable', from: 'old', to: 'new_name' },
					'postgresql',
				);
				expect(sql).toBe('ALTER TABLE "old" RENAME TO "new_name"');
			});
		});

		describe('addColumn', () => {
			it('should generate ADD COLUMN for nullable', () => {
				const sql = operationToSql(
					{ type: 'addColumn', table: 'posts', column: 'body', columnType: 'TEXT', nullable: true },
					'postgresql',
				);
				expect(sql).toBe('ALTER TABLE "posts" ADD COLUMN "body" TEXT');
			});

			it('should generate ADD COLUMN NOT NULL with default', () => {
				const sql = operationToSql(
					{
						type: 'addColumn',
						table: 'posts',
						column: 'status',
						columnType: 'VARCHAR(20)',
						nullable: false,
						defaultValue: "'draft'",
					},
					'postgresql',
				);
				expect(sql).toBe(
					'ALTER TABLE "posts" ADD COLUMN "status" VARCHAR(20) NOT NULL DEFAULT \'draft\'',
				);
			});
		});

		describe('dropColumn', () => {
			it('should generate DROP COLUMN', () => {
				const sql = operationToSql(
					{ type: 'dropColumn', table: 'posts', column: 'legacy' },
					'postgresql',
				);
				expect(sql).toBe('ALTER TABLE "posts" DROP COLUMN "legacy"');
			});
		});

		describe('alterColumnType', () => {
			it('should generate ALTER COLUMN TYPE with USING for postgresql', () => {
				const sql = operationToSql(
					{
						type: 'alterColumnType',
						table: 'posts',
						column: 'rating',
						fromType: 'TEXT',
						toType: 'NUMERIC',
					},
					'postgresql',
				);
				expect(sql).toContain('ALTER TABLE "posts" ALTER COLUMN "rating" TYPE NUMERIC');
				expect(sql).toContain('USING "rating"::NUMERIC');
			});

			it('should use custom cast expression when provided', () => {
				const sql = operationToSql(
					{
						type: 'alterColumnType',
						table: 'posts',
						column: 'score',
						fromType: 'TEXT',
						toType: 'INTEGER',
						castExpression: 'CAST("score" AS INTEGER)',
					},
					'postgresql',
				);
				expect(sql).toContain('USING CAST("score" AS INTEGER)');
			});

			it('should generate comment for sqlite (unsupported)', () => {
				const sql = operationToSql(
					{
						type: 'alterColumnType',
						table: 'posts',
						column: 'rating',
						fromType: 'TEXT',
						toType: 'REAL',
					},
					'sqlite',
				);
				expect(sql).toContain('-- SQLite');
				expect(sql).toContain('Cannot alter column type');
			});
		});

		describe('alterColumnNullable', () => {
			it('should generate SET NOT NULL', () => {
				const sql = operationToSql(
					{ type: 'alterColumnNullable', table: 'posts', column: 'title', nullable: false },
					'postgresql',
				);
				expect(sql).toBe('ALTER TABLE "posts" ALTER COLUMN "title" SET NOT NULL');
			});

			it('should generate DROP NOT NULL', () => {
				const sql = operationToSql(
					{ type: 'alterColumnNullable', table: 'posts', column: 'title', nullable: true },
					'postgresql',
				);
				expect(sql).toBe('ALTER TABLE "posts" ALTER COLUMN "title" DROP NOT NULL');
			});

			it('should generate comment for sqlite', () => {
				const sql = operationToSql(
					{ type: 'alterColumnNullable', table: 'posts', column: 'title', nullable: false },
					'sqlite',
				);
				expect(sql).toContain('-- SQLite');
			});
		});

		describe('alterColumnDefault', () => {
			it('should generate SET DEFAULT', () => {
				const sql = operationToSql(
					{
						type: 'alterColumnDefault',
						table: 'posts',
						column: 'status',
						defaultValue: "'draft'",
						previousDefault: null,
					},
					'postgresql',
				);
				expect(sql).toBe('ALTER TABLE "posts" ALTER COLUMN "status" SET DEFAULT \'draft\'');
			});

			it('should generate DROP DEFAULT', () => {
				const sql = operationToSql(
					{
						type: 'alterColumnDefault',
						table: 'posts',
						column: 'status',
						defaultValue: null,
						previousDefault: "'draft'",
					},
					'postgresql',
				);
				expect(sql).toBe('ALTER TABLE "posts" ALTER COLUMN "status" DROP DEFAULT');
			});
		});

		describe('renameColumn', () => {
			it('should generate RENAME COLUMN', () => {
				const sql = operationToSql(
					{ type: 'renameColumn', table: 'posts', from: 'name', to: 'title' },
					'postgresql',
				);
				expect(sql).toBe('ALTER TABLE "posts" RENAME COLUMN "name" TO "title"');
			});
		});

		describe('addForeignKey', () => {
			it('should generate ADD CONSTRAINT FK for postgresql', () => {
				const sql = operationToSql(
					{
						type: 'addForeignKey',
						table: 'posts',
						constraintName: 'fk_posts_author',
						column: 'author',
						referencedTable: 'users',
						referencedColumn: 'id',
						onDelete: 'SET NULL',
					},
					'postgresql',
				);
				expect(sql).toContain('ADD CONSTRAINT "fk_posts_author"');
				expect(sql).toContain('FOREIGN KEY ("author")');
				expect(sql).toContain('REFERENCES "users"("id")');
				expect(sql).toContain('ON DELETE SET NULL');
			});

			it('should generate comment for sqlite', () => {
				const sql = operationToSql(
					{
						type: 'addForeignKey',
						table: 'posts',
						constraintName: 'fk_posts_author',
						column: 'author',
						referencedTable: 'users',
						referencedColumn: 'id',
						onDelete: 'SET NULL',
					},
					'sqlite',
				);
				expect(sql).toContain('-- SQLite');
			});
		});

		describe('dropForeignKey', () => {
			it('should generate DROP CONSTRAINT for postgresql', () => {
				const sql = operationToSql(
					{ type: 'dropForeignKey', table: 'posts', constraintName: 'fk_posts_author' },
					'postgresql',
				);
				expect(sql).toBe('ALTER TABLE "posts" DROP CONSTRAINT "fk_posts_author"');
			});
		});

		describe('createIndex', () => {
			it('should generate CREATE INDEX', () => {
				const sql = operationToSql(
					{
						type: 'createIndex',
						table: 'posts',
						indexName: 'idx_posts_email',
						columns: ['email'],
						unique: false,
					},
					'postgresql',
				);
				expect(sql).toBe(
					'CREATE INDEX IF NOT EXISTS "idx_posts_email" ON "posts" ("email")',
				);
			});

			it('should generate CREATE UNIQUE INDEX', () => {
				const sql = operationToSql(
					{
						type: 'createIndex',
						table: 'posts',
						indexName: 'idx_posts_email',
						columns: ['email'],
						unique: true,
					},
					'postgresql',
				);
				expect(sql).toContain('CREATE UNIQUE INDEX');
			});

			it('should handle compound indexes', () => {
				const sql = operationToSql(
					{
						type: 'createIndex',
						table: 'posts',
						indexName: 'idx_posts_compound',
						columns: ['email', 'name'],
						unique: false,
					},
					'postgresql',
				);
				expect(sql).toContain('("email", "name")');
			});
		});

		describe('dropIndex', () => {
			it('should generate DROP INDEX', () => {
				const sql = operationToSql(
					{ type: 'dropIndex', table: 'posts', indexName: 'idx_posts_email' },
					'postgresql',
				);
				expect(sql).toBe('DROP INDEX IF EXISTS "idx_posts_email"');
			});
		});

		describe('rawSql', () => {
			it('should return upSql directly', () => {
				const sql = operationToSql(
					{
						type: 'rawSql',
						upSql: 'UPDATE posts SET status = \'active\'',
						downSql: 'UPDATE posts SET status = NULL',
						description: 'Backfill status',
					},
					'postgresql',
				);
				expect(sql).toBe("UPDATE posts SET status = 'active'");
			});
		});
	});

	describe('operationToReverseSql', () => {
		it('should reverse createTable to dropTable', () => {
			const sql = operationToReverseSql(
				{
					type: 'createTable',
					table: 'posts',
					columns: [{ name: 'id', type: 'TEXT', nullable: false }],
				},
				'postgresql',
			);
			expect(sql).toBe('DROP TABLE IF EXISTS "posts"');
		});

		it('should return null for dropTable (irreversible)', () => {
			const sql = operationToReverseSql(
				{ type: 'dropTable', table: 'posts' },
				'postgresql',
			);
			expect(sql).toBeNull();
		});

		it('should reverse addColumn to dropColumn', () => {
			const sql = operationToReverseSql(
				{ type: 'addColumn', table: 'posts', column: 'body', columnType: 'TEXT', nullable: true },
				'postgresql',
			);
			expect(sql).toBe('ALTER TABLE "posts" DROP COLUMN "body"');
		});

		it('should reverse dropColumn when previousType is available', () => {
			const sql = operationToReverseSql(
				{
					type: 'dropColumn',
					table: 'posts',
					column: 'body',
					previousType: 'TEXT',
					previousNullable: true,
				},
				'postgresql',
			);
			expect(sql).toBe('ALTER TABLE "posts" ADD COLUMN "body" TEXT');
		});

		it('should return null for dropColumn without previousType', () => {
			const sql = operationToReverseSql(
				{ type: 'dropColumn', table: 'posts', column: 'body' },
				'postgresql',
			);
			expect(sql).toBeNull();
		});

		it('should reverse renameColumn', () => {
			const sql = operationToReverseSql(
				{ type: 'renameColumn', table: 'posts', from: 'name', to: 'title' },
				'postgresql',
			);
			expect(sql).toBe('ALTER TABLE "posts" RENAME COLUMN "title" TO "name"');
		});

		it('should reverse createIndex to dropIndex', () => {
			const sql = operationToReverseSql(
				{
					type: 'createIndex',
					table: 'posts',
					indexName: 'idx_posts_email',
					columns: ['email'],
					unique: true,
				},
				'postgresql',
			);
			expect(sql).toBe('DROP INDEX IF EXISTS "idx_posts_email"');
		});

		it('should reverse rawSql using downSql', () => {
			const sql = operationToReverseSql(
				{
					type: 'rawSql',
					upSql: 'UPDATE posts SET status = \'active\'',
					downSql: 'UPDATE posts SET status = NULL',
					description: 'test',
				},
				'postgresql',
			);
			expect(sql).toBe('UPDATE posts SET status = NULL');
		});
	});

	describe('operationsToUpSql', () => {
		it('should generate all up SQL in order', () => {
			const ops: MigrationOperation[] = [
				{
					type: 'createTable',
					table: 'posts',
					columns: [{ name: 'id', type: 'TEXT', nullable: false }],
				},
				{
					type: 'createIndex',
					table: 'posts',
					indexName: 'idx_posts_id',
					columns: ['id'],
					unique: true,
				},
			];
			const sqls = operationsToUpSql(ops, 'postgresql');
			expect(sqls).toHaveLength(2);
			expect(sqls[0]).toContain('CREATE TABLE');
			expect(sqls[1]).toContain('CREATE UNIQUE INDEX');
		});
	});

	describe('operationsToDownSql', () => {
		it('should generate down SQL in reverse order', () => {
			const ops: MigrationOperation[] = [
				{
					type: 'createTable',
					table: 'posts',
					columns: [{ name: 'id', type: 'TEXT', nullable: false }],
				},
				{
					type: 'addColumn',
					table: 'posts',
					column: 'title',
					columnType: 'TEXT',
					nullable: true,
				},
			];
			const sqls = operationsToDownSql(ops, 'postgresql');
			expect(sqls).toHaveLength(2);
			// Reversed: dropColumn first, then dropTable
			expect(sqls[0]).toContain('DROP COLUMN');
			expect(sqls[1]).toContain('DROP TABLE');
		});

		it('should skip irreversible operations', () => {
			const ops: MigrationOperation[] = [{ type: 'dropTable', table: 'posts' }];
			const sqls = operationsToDownSql(ops, 'postgresql');
			expect(sqls).toHaveLength(0);
		});
	});
});
