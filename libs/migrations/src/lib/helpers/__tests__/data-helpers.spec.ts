import { describe, it, expect, beforeEach } from 'vitest';
import { createDataHelpers } from '../data-helpers';
import type { DataHelperDb } from '../data-helpers';

// ============================================
// Mock DB that records all executed SQL
// ============================================

function createMockDb(): DataHelperDb & { executedSql: string[]; executedParams: unknown[][] } {
	const executedSql: string[] = [];
	const executedParams: unknown[][] = [];

	return {
		executedSql,
		executedParams,
		async execute(sql: string, params?: unknown[]): Promise<number> {
			executedSql.push(sql);
			executedParams.push(params ?? []);
			// Return a small number to simulate "batch complete" (no more rows)
			return 0;
		},
		async query<T extends Record<string, unknown>>(): Promise<T[]> {
			return [];
		},
	};
}

describe('data-helpers', () => {
	let db: ReturnType<typeof createMockDb>;

	beforeEach(() => {
		db = createMockDb();
	});

	describe('backfill', () => {
		it('should generate batched UPDATE SQL for postgresql', async () => {
			const helpers = createDataHelpers(db, 'postgresql');
			await helpers.backfill('posts', 'status', 'active');

			expect(db.executedSql).toHaveLength(1);
			expect(db.executedSql[0]).toContain('UPDATE "posts"');
			expect(db.executedSql[0]).toContain('SET "status" = $1');
			expect(db.executedSql[0]).toContain('WHERE "status" IS NULL');
			expect(db.executedParams[0]).toEqual(['active']);
		});

		it('should generate batched UPDATE SQL for sqlite', async () => {
			const helpers = createDataHelpers(db, 'sqlite');
			await helpers.backfill('users', 'role', 'member');

			expect(db.executedSql[0]).toContain('UPDATE "users"');
			expect(db.executedSql[0]).toContain('SET "role" = ?');
			expect(db.executedSql[0]).toContain('rowid');
		});

		it('should include WHERE clause when provided', async () => {
			const helpers = createDataHelpers(db, 'postgresql');
			await helpers.backfill('posts', 'status', 'draft', { where: '"type" = \'blog\'' });

			expect(db.executedSql[0]).toContain('"type" = \'blog\'');
		});

		it('should return total affected rows', async () => {
			const helpers = createDataHelpers(db, 'postgresql');
			const affected = await helpers.backfill('posts', 'status', 'active');
			expect(affected).toBe(0); // Mock returns 0
		});
	});

	describe('transform', () => {
		it('should generate UPDATE with SQL expression', async () => {
			const helpers = createDataHelpers(db, 'postgresql');
			await helpers.transform('posts', 'slug', "LOWER(REPLACE(\"title\", ' ', '-'))");

			expect(db.executedSql).toHaveLength(1);
			expect(db.executedSql[0]).toContain('UPDATE "posts"');
			expect(db.executedSql[0]).toContain('SET "slug" = LOWER');
		});

		it('should include WHERE clause', async () => {
			const helpers = createDataHelpers(db, 'postgresql');
			await helpers.transform('posts', 'slug', "LOWER(\"title\")", { where: '"slug" IS NULL' });

			expect(db.executedSql[0]).toContain('WHERE "slug" IS NULL');
		});
	});

	describe('renameColumn', () => {
		it('should add, copy, and drop in sequence', async () => {
			const helpers = createDataHelpers(db, 'postgresql');
			await helpers.renameColumn('posts', 'name', 'title', 'TEXT');

			expect(db.executedSql).toHaveLength(3);
			expect(db.executedSql[0]).toContain('ADD COLUMN "title" TEXT');
			expect(db.executedSql[1]).toContain('SET "title" = "name"');
			expect(db.executedSql[2]).toContain('DROP COLUMN "name"');
		});
	});

	describe('splitColumn', () => {
		it('should add and populate target columns', async () => {
			const helpers = createDataHelpers(db, 'postgresql');
			await helpers.splitColumn('users', 'full_name', [
				{ name: 'first_name', type: 'TEXT', expression: "SPLIT_PART(\"full_name\", ' ', 1)" },
				{ name: 'last_name', type: 'TEXT', expression: "SPLIT_PART(\"full_name\", ' ', 2)" },
			]);

			expect(db.executedSql).toHaveLength(4);
			expect(db.executedSql[0]).toContain('ADD COLUMN "first_name"');
			expect(db.executedSql[1]).toContain('SET "first_name" = SPLIT_PART');
			expect(db.executedSql[2]).toContain('ADD COLUMN "last_name"');
			expect(db.executedSql[3]).toContain('SET "last_name" = SPLIT_PART');
		});
	});

	describe('mergeColumns', () => {
		it('should add target and populate with merge expression', async () => {
			const helpers = createDataHelpers(db, 'postgresql');
			await helpers.mergeColumns(
				'users',
				['first_name', 'last_name'],
				'full_name',
				'TEXT',
				'"first_name" || \' \' || "last_name"',
			);

			expect(db.executedSql).toHaveLength(2);
			expect(db.executedSql[0]).toContain('ADD COLUMN "full_name" TEXT');
			expect(db.executedSql[1]).toContain('SET "full_name" =');
		});
	});

	describe('copyData', () => {
		it('should generate INSERT INTO ... SELECT', async () => {
			const helpers = createDataHelpers(db, 'postgresql');
			await helpers.copyData('old_posts', 'new_posts', {
				id: 'id',
				title: 'name',
				body: { expression: 'COALESCE("content", \'\')' },
			});

			expect(db.executedSql).toHaveLength(1);
			expect(db.executedSql[0]).toContain('INSERT INTO "new_posts"');
			expect(db.executedSql[0]).toContain('SELECT');
			expect(db.executedSql[0]).toContain('FROM "old_posts"');
		});

		it('should include WHERE clause', async () => {
			const helpers = createDataHelpers(db, 'postgresql');
			await helpers.copyData('posts', 'archive', { id: 'id' }, { where: '"status" = \'old\'' });

			expect(db.executedSql[0]).toContain('WHERE "status" = \'old\'');
		});
	});

	describe('columnToJson', () => {
		it('should generate jsonb merge for postgresql', async () => {
			const helpers = createDataHelpers(db, 'postgresql');
			await helpers.columnToJson('users', 'phone', 'metadata', 'phone_number');

			expect(db.executedSql[0]).toContain('jsonb_build_object');
			expect(db.executedSql[0]).toContain('phone_number');
		});

		it('should generate json_set for sqlite', async () => {
			const helpers = createDataHelpers(db, 'sqlite');
			await helpers.columnToJson('users', 'phone', 'metadata', 'phone_number');

			expect(db.executedSql[0]).toContain('json_set');
			expect(db.executedSql[0]).toContain('$.phone_number');
		});
	});

	describe('jsonToColumn', () => {
		it('should add column and extract from jsonb for postgresql', async () => {
			const helpers = createDataHelpers(db, 'postgresql');
			await helpers.jsonToColumn('users', 'metadata', 'phone_number', 'phone', 'TEXT');

			expect(db.executedSql).toHaveLength(2);
			expect(db.executedSql[0]).toContain('ADD COLUMN "phone" TEXT');
			expect(db.executedSql[1]).toContain("->>'phone_number'");
		});

		it('should add column and extract with json_extract for sqlite', async () => {
			const helpers = createDataHelpers(db, 'sqlite');
			await helpers.jsonToColumn('users', 'metadata', 'phone_number', 'phone', 'TEXT');

			expect(db.executedSql).toHaveLength(2);
			expect(db.executedSql[0]).toContain('ADD COLUMN "phone" TEXT');
			expect(db.executedSql[1]).toContain('json_extract');
		});
	});

	describe('dedup', () => {
		it('should generate DELETE with DISTINCT ON for postgresql (latest)', async () => {
			const helpers = createDataHelpers(db, 'postgresql');
			await helpers.dedup('users', ['email'], 'latest');

			expect(db.executedSql).toHaveLength(1);
			expect(db.executedSql[0]).toContain('DELETE FROM "users"');
			expect(db.executedSql[0]).toContain('DISTINCT ON ("email")');
			expect(db.executedSql[0]).toContain('"createdAt" DESC');
		});

		it('should generate DELETE with GROUP BY for sqlite', async () => {
			const helpers = createDataHelpers(db, 'sqlite');
			await helpers.dedup('users', ['email']);

			expect(db.executedSql[0]).toContain('DELETE FROM "users"');
			expect(db.executedSql[0]).toContain('GROUP BY "email"');
			expect(db.executedSql[0]).toContain('MIN(rowid)');
		});

		it('should use earliest strategy', async () => {
			const helpers = createDataHelpers(db, 'postgresql');
			await helpers.dedup('users', ['email'], 'earliest');

			expect(db.executedSql[0]).toContain('"createdAt" ASC');
		});

		it('should handle multi-column dedup', async () => {
			const helpers = createDataHelpers(db, 'postgresql');
			await helpers.dedup('records', ['email', 'type'], 'latest');

			expect(db.executedSql[0]).toContain('"email", "type"');
		});
	});
});
