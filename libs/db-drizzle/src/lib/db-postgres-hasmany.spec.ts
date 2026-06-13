import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CollectionConfig } from '@momentumcms/core';

/**
 * Tests for hasMany (JSONB) field query generation in the PostgreSQL adapter.
 *
 * hasMany relationship fields are stored as JSONB arrays. Standard comparison
 * operators ($eq, $ne, $contains) must use PostgreSQL JSONB operators (@>, NOT @>)
 * instead of scalar comparisons (=, !=) to produce correct results.
 */

// Capture all SQL queries sent to the pool
const capturedQueries: Array<{ text: string; values: unknown[] }> = [];

vi.mock('pg', () => {
	const mockQuery = vi.fn().mockImplementation((text: string, values?: unknown[]) => {
		capturedQueries.push({ text, values: values ?? [] });
		return Promise.resolve({ rows: [], rowCount: 0 });
	});

	class MockPool {
		query = mockQuery;
		connect = vi.fn().mockResolvedValue({
			query: mockQuery,
			release: vi.fn(),
		});
		end = vi.fn();
	}

	class MockClient {
		connect = vi.fn();
		query = mockQuery;
		end = vi.fn();
	}

	return { Pool: MockPool, Client: MockClient };
});

const mediaCollection: CollectionConfig = {
	slug: 'media',
	labels: { singular: 'Media', plural: 'Media' },
	fields: [
		{ name: 'filename', type: 'text', required: true },
		{ name: 'mimeType', type: 'text', required: true },
		{
			name: 'tags',
			type: 'relationship',
			relationTo: 'media-tags',
			hasMany: true,
		},
		{ name: 'folder', type: 'relationship', relationTo: 'media-folders' },
	],
};

describe('PostgreSQL adapter — hasMany JSONB query generation', () => {
	let adapter: Awaited<ReturnType<typeof import('./db-postgres').postgresAdapter>>;

	beforeEach(async () => {
		capturedQueries.length = 0;
		const { postgresAdapter } = await import('./db-postgres');
		adapter = postgresAdapter({ connectionString: 'postgresql://mock:mock@localhost/mock' });
		// registerCollections populates hasManyFieldsMap without DDL
		adapter.registerCollections([mediaCollection]);
	});

	/** Get the last SELECT query and assert it exists. */
	function expectLastSelect(): { text: string; values: unknown[] } {
		const query = [...capturedQueries]
			.reverse()
			.find((q) => q.text.trimStart().startsWith('SELECT'));
		expect(query).toBeDefined();
		// Safe to return — the assertion above fails the test if undefined
		return query as { text: string; values: unknown[] };
	}

	describe('$eq on hasMany field', () => {
		it('should use JSONB containment (@>) instead of scalar equals', async () => {
			await adapter.find('media', { tags: { $eq: 'tag-1' } });
			const query = expectLastSelect();
			expect(query.text).toContain('@>');
			expect(query.text).not.toMatch(/"tags"\s*=\s*\$/);
			expect(query.values).toContain(JSON.stringify(['tag-1']));
		});
	});

	describe('$ne on hasMany field', () => {
		it('should use NOT JSONB containment instead of scalar not-equals', async () => {
			await adapter.find('media', { tags: { $ne: 'tag-1' } });
			const query = expectLastSelect();
			expect(query.text).toContain('NOT');
			expect(query.text).toContain('@>');
			expect(query.text).not.toMatch(/"tags"\s*!=\s*\$/);
			expect(query.values).toContain(JSON.stringify(['tag-1']));
		});
	});

	describe('$contains on hasMany field', () => {
		it('should use JSONB containment instead of ILIKE', async () => {
			await adapter.find('media', { tags: { $contains: 'tag-1' } });
			const query = expectLastSelect();
			expect(query.text).toContain('@>');
			expect(query.text).not.toContain('ILIKE');
		});
	});

	describe('$in/$nin on hasMany field (existing behavior, should still work)', () => {
		it('$in should use JSONB containment with OR', async () => {
			await adapter.find('media', { tags: { $in: ['tag-1', 'tag-2'] } });
			const query = expectLastSelect();
			expect(query.text).toContain('@>');
			expect(query.text).toContain('OR');
		});

		it('$nin should use NOT JSONB containment with AND', async () => {
			await adapter.find('media', { tags: { $nin: ['tag-1', 'tag-2'] } });
			const query = expectLastSelect();
			expect(query.text).toContain('NOT');
			expect(query.text).toContain('@>');
			expect(query.text).toContain('AND');
		});
	});

	describe('non-hasMany fields should still use scalar operators', () => {
		it('$eq on regular field should use scalar equals', async () => {
			await adapter.find('media', { folder: { $eq: 'folder-1' } });
			const query = expectLastSelect();
			expect(query.text).toMatch(/"folder"\s*=\s*\$/);
			expect(query.values).toContain('folder-1');
		});

		it('$ne on regular field should use scalar not-equals', async () => {
			await adapter.find('media', { folder: { $ne: 'folder-1' } });
			const query = expectLastSelect();
			expect(query.text).toMatch(/"folder"\s*!=\s*\$/);
		});
	});

	// Regression: momentum-api's search() passes `limit: 0` to fetch ALL matches for
	// accurate totals before in-memory filtering + pagination. `limit: 0` must mean
	// "no limit", NOT a literal `LIMIT 0` (which returns zero rows and silently breaks
	// search). The `?? 20` default keeps 0 (it is not nullish), so the SQL builder must
	// special-case it. The SQLite/in-memory test adapters ignore limit, so only this
	// SQL-generation assertion guards the contract.
	describe('search() limit:0 contract (no-limit)', () => {
		it('omits the LIMIT/OFFSET clause when limit is 0', async () => {
			await adapter.search?.('media', 'hello', ['filename'], { limit: 0, page: 1 });
			const query = expectLastSelect();
			expect(query.text).not.toMatch(/\bLIMIT\b/i);
			expect(query.text).not.toMatch(/\bOFFSET\b/i);
			// Only the search query + per-field ILIKE params — no limit/offset params appended.
			expect(query.values).toEqual(['hello', '%hello%']);
		});

		it('includes LIMIT/OFFSET when a positive limit is given', async () => {
			await adapter.search?.('media', 'hello', ['filename'], { limit: 10, page: 2 });
			const query = expectLastSelect();
			expect(query.text).toMatch(/\bLIMIT\b/i);
			expect(query.text).toMatch(/\bOFFSET\b/i);
			// search query + ILIKE param + limit + offset (page 2 → offset 10)
			expect(query.values).toEqual(['hello', '%hello%', 10, 10]);
		});
	});
});
