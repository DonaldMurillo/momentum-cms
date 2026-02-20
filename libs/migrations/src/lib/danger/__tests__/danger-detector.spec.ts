import { describe, it, expect } from 'vitest';
import type { MigrationOperation } from '../../operations/operation.types';
import { detectDangers } from '../danger-detector';

describe('danger-detector', () => {
	describe('no dangers', () => {
		it('should report clean for safe operations', () => {
			const ops: MigrationOperation[] = [
				{
					type: 'addColumn',
					table: 'posts',
					column: 'body',
					columnType: 'TEXT',
					nullable: true,
				},
			];
			const result = detectDangers(ops, 'postgresql');

			expect(result.hasErrors).toBe(false);
			expect(result.hasWarnings).toBe(false);
			expect(result.warnings).toHaveLength(0);
		});
	});

	describe('dropTable', () => {
		it('should flag as error', () => {
			const ops: MigrationOperation[] = [{ type: 'dropTable', table: 'posts' }];
			const result = detectDangers(ops, 'postgresql');

			expect(result.hasErrors).toBe(true);
			expect(result.warnings).toHaveLength(1);
			expect(result.warnings[0].severity).toBe('error');
			expect(result.warnings[0].message).toContain('Dropping table "posts"');
			expect(result.warnings[0].suggestion).toContain('deprecation prefix');
		});
	});

	describe('dropColumn', () => {
		it('should flag as warning', () => {
			const ops: MigrationOperation[] = [
				{ type: 'dropColumn', table: 'posts', column: 'legacy' },
			];
			const result = detectDangers(ops, 'postgresql');

			expect(result.hasWarnings).toBe(true);
			expect(result.warnings[0].severity).toBe('warning');
			expect(result.warnings[0].message).toContain('Dropping column');
		});
	});

	describe('addColumn NOT NULL without default', () => {
		it('should flag as error', () => {
			const ops: MigrationOperation[] = [
				{
					type: 'addColumn',
					table: 'posts',
					column: 'required_field',
					columnType: 'TEXT',
					nullable: false,
				},
			];
			const result = detectDangers(ops, 'postgresql');

			expect(result.hasErrors).toBe(true);
			expect(result.warnings[0].severity).toBe('error');
			expect(result.warnings[0].message).toContain('NOT NULL');
			expect(result.warnings[0].message).toContain('without a default');
		});

		it('should NOT flag when default value is provided', () => {
			const ops: MigrationOperation[] = [
				{
					type: 'addColumn',
					table: 'posts',
					column: 'status',
					columnType: 'TEXT',
					nullable: false,
					defaultValue: "'active'",
				},
			];
			const result = detectDangers(ops, 'postgresql');

			expect(result.hasErrors).toBe(false);
		});

		it('should NOT flag when column is nullable', () => {
			const ops: MigrationOperation[] = [
				{
					type: 'addColumn',
					table: 'posts',
					column: 'optional',
					columnType: 'TEXT',
					nullable: true,
				},
			];
			const result = detectDangers(ops, 'postgresql');

			expect(result.warnings).toHaveLength(0);
		});
	});

	describe('alterColumnNullable (set NOT NULL)', () => {
		it('should flag as warning when making column NOT NULL', () => {
			const ops: MigrationOperation[] = [
				{ type: 'alterColumnNullable', table: 'posts', column: 'title', nullable: false },
			];
			const result = detectDangers(ops, 'postgresql');

			expect(result.hasWarnings).toBe(true);
			expect(result.warnings[0].message).toContain('NOT NULL');
			expect(result.warnings[0].suggestion).toContain('backfill');
		});

		it('should NOT flag when making column nullable', () => {
			const ops: MigrationOperation[] = [
				{ type: 'alterColumnNullable', table: 'posts', column: 'title', nullable: true },
			];
			const result = detectDangers(ops, 'postgresql');

			expect(result.warnings).toHaveLength(0);
		});
	});

	describe('alterColumnType', () => {
		it('should flag TEXT to NUMERIC as lossy warning', () => {
			const ops: MigrationOperation[] = [
				{
					type: 'alterColumnType',
					table: 'posts',
					column: 'score',
					fromType: 'TEXT',
					toType: 'NUMERIC',
				},
			];
			const result = detectDangers(ops, 'postgresql');

			expect(result.hasWarnings).toBe(true);
			const lossy = result.warnings.find((w) => w.message.includes('data loss'));
			expect(lossy).toBeDefined();
		});

		it('should flag VARCHAR shrinkage as lossy', () => {
			const ops: MigrationOperation[] = [
				{
					type: 'alterColumnType',
					table: 'posts',
					column: 'email',
					fromType: 'VARCHAR(255)',
					toType: 'VARCHAR(50)',
				},
			];
			const result = detectDangers(ops, 'postgresql');

			const lossy = result.warnings.find((w) => w.message.includes('data loss'));
			expect(lossy).toBeDefined();
		});

		it('should flag SQLite type change as error', () => {
			const ops: MigrationOperation[] = [
				{
					type: 'alterColumnType',
					table: 'posts',
					column: 'score',
					fromType: 'TEXT',
					toType: 'REAL',
				},
			];
			const result = detectDangers(ops, 'sqlite');

			expect(result.hasErrors).toBe(true);
			expect(result.warnings[0].message).toContain('SQLite does not support');
		});

		it('should flag TEXT to VARCHAR as table rewrite info', () => {
			const ops: MigrationOperation[] = [
				{
					type: 'alterColumnType',
					table: 'posts',
					column: 'name',
					fromType: 'TEXT',
					toType: 'VARCHAR(255)',
				},
			];
			const result = detectDangers(ops, 'postgresql');

			const rewrite = result.warnings.find((w) => w.message.includes('table rewrite'));
			expect(rewrite).toBeDefined();
			expect(rewrite?.severity).toBe('info');
		});
	});

	describe('renameColumn', () => {
		it('should flag as warning', () => {
			const ops: MigrationOperation[] = [
				{ type: 'renameColumn', table: 'posts', from: 'name', to: 'title' },
			];
			const result = detectDangers(ops, 'postgresql');

			expect(result.hasWarnings).toBe(true);
			expect(result.warnings[0].message).toContain('break application code');
		});
	});

	describe('renameTable', () => {
		it('should flag as warning', () => {
			const ops: MigrationOperation[] = [
				{ type: 'renameTable', from: 'posts', to: 'articles' },
			];
			const result = detectDangers(ops, 'postgresql');

			expect(result.hasWarnings).toBe(true);
			expect(result.warnings[0].message).toContain('Renaming table');
		});
	});

	describe('addForeignKey', () => {
		it('should flag as info for postgresql (lock warning)', () => {
			const ops: MigrationOperation[] = [
				{
					type: 'addForeignKey',
					table: 'posts',
					constraintName: 'fk_posts_author',
					column: 'author',
					referencedTable: 'users',
					referencedColumn: 'id',
					onDelete: 'SET NULL',
				},
			];
			const result = detectDangers(ops, 'postgresql');

			expect(result.warnings.some((w) => w.severity === 'info')).toBe(true);
			expect(result.warnings[0].message).toContain('ACCESS EXCLUSIVE lock');
		});

		it('should NOT flag for sqlite', () => {
			const ops: MigrationOperation[] = [
				{
					type: 'addForeignKey',
					table: 'posts',
					constraintName: 'fk_posts_author',
					column: 'author',
					referencedTable: 'users',
					referencedColumn: 'id',
					onDelete: 'SET NULL',
				},
			];
			const result = detectDangers(ops, 'sqlite');

			expect(result.warnings).toHaveLength(0);
		});
	});

	describe('createIndex', () => {
		it('should flag as info for postgresql (lock warning)', () => {
			const ops: MigrationOperation[] = [
				{
					type: 'createIndex',
					table: 'posts',
					indexName: 'idx_posts_email',
					columns: ['email'],
					unique: true,
				},
			];
			const result = detectDangers(ops, 'postgresql');

			expect(result.warnings.some((w) => w.severity === 'info')).toBe(true);
			expect(result.warnings[0].message).toContain('lock');
		});
	});

	describe('sorting', () => {
		it('should sort errors before warnings before info', () => {
			const ops: MigrationOperation[] = [
				{ type: 'renameColumn', table: 'posts', from: 'a', to: 'b' }, // warning
				{ type: 'dropTable', table: 'old' }, // error
				{
					type: 'createIndex',
					table: 'posts',
					indexName: 'idx',
					columns: ['a'],
					unique: false,
				}, // info
			];
			const result = detectDangers(ops, 'postgresql');

			expect(result.warnings.length).toBeGreaterThan(0);
			expect(result.warnings[0].severity).toBe('error');

			// Find indices of each type
			const errorIdx = result.warnings.findIndex((w) => w.severity === 'error');
			const warningIdx = result.warnings.findIndex((w) => w.severity === 'warning');
			const infoIdx = result.warnings.findIndex((w) => w.severity === 'info');

			if (errorIdx >= 0 && warningIdx >= 0) {
				expect(errorIdx).toBeLessThan(warningIdx);
			}
			if (warningIdx >= 0 && infoIdx >= 0) {
				expect(warningIdx).toBeLessThan(infoIdx);
			}
		});
	});

	describe('multiple operations', () => {
		it('should flag multiple dangers from multiple operations', () => {
			const ops: MigrationOperation[] = [
				{ type: 'dropTable', table: 'old' },
				{ type: 'dropColumn', table: 'posts', column: 'legacy' },
				{
					type: 'addColumn',
					table: 'posts',
					column: 'required',
					columnType: 'TEXT',
					nullable: false,
				},
			];
			const result = detectDangers(ops, 'postgresql');

			// dropTable (error) + dropColumn (warning) + addColumn NOT NULL (error)
			expect(result.hasErrors).toBe(true);
			expect(result.hasWarnings).toBe(true);
			expect(result.warnings.length).toBeGreaterThanOrEqual(3);
		});
	});

	describe('createTable (safe)', () => {
		it('should not flag createTable', () => {
			const ops: MigrationOperation[] = [
				{
					type: 'createTable',
					table: 'posts',
					columns: [
						{ name: 'id', type: 'VARCHAR(36)', nullable: false, primaryKey: true },
					],
				},
			];
			const result = detectDangers(ops, 'postgresql');

			expect(result.warnings).toHaveLength(0);
		});
	});

	describe('rawSql', () => {
		it('should not flag raw SQL by default', () => {
			const ops: MigrationOperation[] = [
				{
					type: 'rawSql',
					upSql: 'SELECT 1',
					downSql: 'SELECT 1',
					description: 'test',
				},
			];
			const result = detectDangers(ops, 'postgresql');
			expect(result.warnings).toHaveLength(0);
		});
	});
});
