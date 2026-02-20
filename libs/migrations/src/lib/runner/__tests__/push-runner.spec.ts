import { describe, it, expect, vi } from 'vitest';
import { runPush } from '../push-runner';
import type { PushRunnerOptions } from '../push-runner';
import { createSchemaSnapshot } from '../../schema/schema-snapshot';
import type { TableSnapshot, ColumnSnapshot } from '../../schema/schema-snapshot';
import { defineCollection, text, number } from '@momentumcms/core';

// ============================================
// Helpers
// ============================================

function col(name: string, type = 'TEXT', nullable = true): ColumnSnapshot {
	return { name, type, nullable, defaultValue: null, isPrimaryKey: false };
}

function table(name: string, columns: ColumnSnapshot[]): TableSnapshot {
	return { name, columns, foreignKeys: [], indexes: [] };
}

function makeOptions(
	overrides: Partial<PushRunnerOptions> = {},
): PushRunnerOptions {
	const executedSql: string[] = [];
	return {
		collections: [defineCollection({ slug: 'posts', fields: [text('title')] })],
		dialect: 'postgresql',
		db: {
			async executeRaw(sql: string): Promise<number> {
				executedSql.push(sql);
				return 1;
			},
		},
		introspect: async () => createSchemaSnapshot('postgresql', []),
		log: { info: vi.fn(), warn: vi.fn() },
		...overrides,
	};
}

describe('push-runner', () => {
	describe('no changes needed', () => {
		it('should report no changes when schemas match', async () => {
			const collections = [defineCollection({ slug: 'posts', fields: [text('title')] })];
			const existingTable = table('posts', [
				col('id', 'VARCHAR(36)', false),
				col('createdAt', 'TIMESTAMPTZ', false),
				col('updatedAt', 'TIMESTAMPTZ', false),
				col('title', 'TEXT', true),
			]);

			const result = await runPush(
				makeOptions({
					collections,
					introspect: async () => createSchemaSnapshot('postgresql', [existingTable]),
				}),
			);

			expect(result.applied).toBe(false);
			expect(result.diff.hasChanges).toBe(false);
			expect(result.sqlStatements).toHaveLength(0);
		});
	});

	describe('new table', () => {
		it('should execute CREATE TABLE SQL', async () => {
			const executedSql: string[] = [];
			const result = await runPush(
				makeOptions({
					db: {
						async executeRaw(sql: string): Promise<number> {
							executedSql.push(sql);
							return 1;
						},
					},
				}),
			);

			expect(result.applied).toBe(true);
			expect(result.successCount).toBeGreaterThan(0);
			expect(executedSql.some((s) => s.includes('CREATE TABLE'))).toBe(true);
		});
	});

	describe('dry run', () => {
		it('should not execute any SQL in dry run mode', async () => {
			const executedSql: string[] = [];
			const result = await runPush(
				makeOptions({
					dryRun: true,
					db: {
						async executeRaw(sql: string): Promise<number> {
							executedSql.push(sql);
							return 1;
						},
					},
				}),
			);

			expect(result.applied).toBe(false);
			expect(result.sqlStatements.length).toBeGreaterThan(0);
			expect(executedSql).toHaveLength(0);
		});
	});

	describe('danger detection', () => {
		it('should block when dangerous operations are detected', async () => {
			// Set up a scenario where a table needs to be dropped
			const collections = [defineCollection({ slug: 'posts', fields: [text('title')] })];
			const existingTables = [
				table('posts', [
					col('id', 'VARCHAR(36)', false),
					col('createdAt', 'TIMESTAMPTZ', false),
					col('updatedAt', 'TIMESTAMPTZ', false),
					col('title', 'TEXT', true),
				]),
				// This table will be "dropped" since it's not in collections
				table('old_table', [col('id', 'VARCHAR(36)', false)]),
			];

			const result = await runPush(
				makeOptions({
					collections,
					introspect: async () =>
						createSchemaSnapshot('postgresql', existingTables),
				}),
			);

			expect(result.applied).toBe(false);
			expect(result.dangers).not.toBeNull();
			expect(result.dangers?.hasErrors).toBe(true);
		});

		it('should proceed when skipDangerDetection is true', async () => {
			const collections = [defineCollection({ slug: 'posts', fields: [text('title')] })];
			const existingTables = [
				table('posts', [
					col('id', 'VARCHAR(36)', false),
					col('createdAt', 'TIMESTAMPTZ', false),
					col('updatedAt', 'TIMESTAMPTZ', false),
					col('title', 'TEXT', true),
				]),
				table('old_table', [col('id', 'VARCHAR(36)', false)]),
			];

			const executedSql: string[] = [];
			const result = await runPush(
				makeOptions({
					collections,
					skipDangerDetection: true,
					introspect: async () =>
						createSchemaSnapshot('postgresql', existingTables),
					db: {
						async executeRaw(sql: string): Promise<number> {
							executedSql.push(sql);
							return 1;
						},
					},
				}),
			);

			expect(result.applied).toBe(true);
			expect(result.dangers).toBeNull();
		});
	});

	describe('SQL execution errors', () => {
		it('should capture errors and continue', async () => {
			const collections = [
				defineCollection({ slug: 'posts', fields: [text('title'), number('count')] }),
			];
			let callCount = 0;

			const result = await runPush(
				makeOptions({
					collections,
					db: {
						async executeRaw(_sql: string): Promise<number> {
							callCount++;
							if (callCount === 1) throw new Error('Simulated failure');
							return 1;
						},
					},
				}),
			);

			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.errors[0].error).toBe('Simulated failure');
		});
	});
});
