import { describe, it, expect } from 'vitest';
import type { SchemaDiffResult } from '../../schema/schema-diff';
import type { MigrationOperation } from '../../operations/operation.types';
import {
	generateMigrationName,
	generateMigrationFileContent,
} from '../migration-file-generator';

describe('migration-file-generator', () => {
	describe('generateMigrationName', () => {
		it('should produce a timestamp-prefixed name', () => {
			const date = new Date(2026, 1, 20, 14, 30, 45); // Feb 20, 2026 14:30:45
			const name = generateMigrationName('add_posts_table', date);
			expect(name).toBe('20260220143045_add_posts_table');
		});

		it('should pad single-digit months and days', () => {
			const date = new Date(2026, 0, 5, 3, 7, 9); // Jan 5, 2026 03:07:09
			const name = generateMigrationName('init', date);
			expect(name).toBe('20260105030709_init');
		});

		it('should use current time when no timestamp provided', () => {
			const name = generateMigrationName('test');
			expect(name).toMatch(/^\d{14}_test$/);
		});
	});

	describe('generateMigrationFileContent', () => {
		it('should generate valid TypeScript with imports', () => {
			const diff = makeDiff([
				{
					type: 'createTable',
					table: 'posts',
					columns: [
						{ name: 'id', type: 'VARCHAR(36)', nullable: false, primaryKey: true },
						{ name: 'title', type: 'TEXT', nullable: false },
					],
				},
			]);

			const content = generateMigrationFileContent(diff, {
				name: '20260220_create_posts',
				dialect: 'postgresql',
			});

			expect(content).toContain("import type { MigrationFile, MigrationContext }");
			expect(content).toContain("from '@momentumcms/migrations'");
			expect(content).toContain('export const meta: MigrationFile[\'meta\']');
			expect(content).toContain('export async function up');
			expect(content).toContain('export async function down');
		});

		it('should include meta with name and description', () => {
			const diff = makeDiff([
				{ type: 'addColumn', table: 'posts', column: 'body', columnType: 'TEXT', nullable: true },
			]);

			const content = generateMigrationFileContent(diff, {
				name: 'add_body_to_posts',
				description: 'Add body column to posts table',
				dialect: 'postgresql',
			});

			expect(content).toContain('"add_body_to_posts"');
			expect(content).toContain('"Add body column to posts table"');
		});

		it('should auto-generate description from summary when not provided', () => {
			const diff: SchemaDiffResult = {
				hasChanges: true,
				operations: [
					{ type: 'addColumn', table: 'posts', column: 'body', columnType: 'TEXT', nullable: true },
				],
				summary: ['Add column "posts"."body" (TEXT)'],
			};

			const content = generateMigrationFileContent(diff, {
				name: 'test',
				dialect: 'postgresql',
			});

			expect(content).toContain('Add column \\"posts\\".\\"body\\" (TEXT)');
		});

		it('should include operations metadata in meta', () => {
			const diff = makeDiff([
				{ type: 'addColumn', table: 'posts', column: 'body', columnType: 'TEXT', nullable: true },
				{ type: 'dropColumn', table: 'posts', column: 'legacy' },
			]);

			const content = generateMigrationFileContent(diff, {
				name: 'test',
				dialect: 'postgresql',
			});

			expect(content).toContain('"addColumn"');
			expect(content).toContain('"dropColumn"');
		});

		it('should generate up() with SQL statements', () => {
			const diff = makeDiff([
				{ type: 'addColumn', table: 'posts', column: 'body', columnType: 'TEXT', nullable: true },
			]);

			const content = generateMigrationFileContent(diff, {
				name: 'test',
				dialect: 'postgresql',
			});

			expect(content).toContain('await ctx.sql(');
			// SQL is JSON.stringify'd, so double quotes are escaped
			expect(content).toContain('ALTER TABLE \\"posts\\" ADD COLUMN \\"body\\" TEXT');
		});

		it('should generate down() with reverse SQL in reverse order', () => {
			const diff = makeDiff([
				{
					type: 'createTable',
					table: 'posts',
					columns: [{ name: 'id', type: 'TEXT', nullable: false }],
				},
				{ type: 'addColumn', table: 'posts', column: 'title', columnType: 'TEXT', nullable: true },
			]);

			const content = generateMigrationFileContent(diff, {
				name: 'test',
				dialect: 'postgresql',
			});

			// down() should reverse: drop column first, then drop table
			const downSection = content.slice(content.indexOf('async function down'));
			expect(downSection).toContain('DROP COLUMN');
			expect(downSection).toContain('DROP TABLE');

			// DROP COLUMN should appear before DROP TABLE in down
			const dropColIdx = downSection.indexOf('DROP COLUMN');
			const dropTableIdx = downSection.indexOf('DROP TABLE');
			expect(dropColIdx).toBeLessThan(dropTableIdx);
		});

		it('should handle SQLite limitations as comments', () => {
			const diff = makeDiff([
				{
					type: 'alterColumnType',
					table: 'posts',
					column: 'rating',
					fromType: 'TEXT',
					toType: 'REAL',
				},
			]);

			const content = generateMigrationFileContent(diff, {
				name: 'test',
				dialect: 'sqlite',
			});

			// SQLite ALTER TYPE becomes a comment
			expect(content).toContain('// SQLite');
		});

		it('should handle empty diff gracefully', () => {
			const diff: SchemaDiffResult = {
				hasChanges: false,
				operations: [],
				summary: [],
			};

			const content = generateMigrationFileContent(diff, {
				name: 'empty',
				dialect: 'postgresql',
			});

			expect(content).toContain('// No operations');
		});
	});
});

// ============================================
// Helpers
// ============================================

function makeDiff(operations: MigrationOperation[]): SchemaDiffResult {
	return {
		hasChanges: operations.length > 0,
		operations,
		summary: [],
	};
}
