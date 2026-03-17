import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sqliteAdapter } from './db-drizzle';
import { existsSync, unlinkSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { CollectionConfig } from '@momentumcms/core';

const TEST_DB_DIR = './test-data';
const TEST_DB_PATH = join(TEST_DB_DIR, 'test.db');

const mockPostsCollection: CollectionConfig = {
	slug: 'posts',
	labels: { singular: 'Post', plural: 'Posts' },
	fields: [
		{ name: 'title', type: 'text', required: true, label: 'Title' },
		{ name: 'content', type: 'textarea', label: 'Content' },
	],
};

const mockProductsCollection: CollectionConfig = {
	slug: 'products',
	labels: { singular: 'Product', plural: 'Products' },
	fields: [
		{ name: 'name', type: 'text', required: true },
		{
			name: 'metadata',
			type: 'group',
			fields: [
				{ name: 'color', type: 'text' },
				{ name: 'size', type: 'number' },
			],
		},
	],
};

describe('sqliteAdapter', () => {
	beforeEach(() => {
		// Ensure test directory exists
		if (!existsSync(TEST_DB_DIR)) {
			mkdirSync(TEST_DB_DIR, { recursive: true });
		}
		// Remove any existing test database
		if (existsSync(TEST_DB_PATH)) {
			unlinkSync(TEST_DB_PATH);
		}
	});

	afterEach(() => {
		// Clean up test database
		if (existsSync(TEST_DB_PATH)) {
			unlinkSync(TEST_DB_PATH);
		}
		// Clean up test directory
		if (existsSync(TEST_DB_DIR)) {
			rmSync(TEST_DB_DIR, { recursive: true });
		}
	});

	it('should create database file and directory if they do not exist', () => {
		const adapter = sqliteAdapter({ filename: TEST_DB_PATH });
		expect(existsSync(TEST_DB_PATH)).toBe(true);
		expect(adapter).toBeDefined();
	});

	it('should initialize tables for collections', async () => {
		const adapter = sqliteAdapter({ filename: TEST_DB_PATH });
		await adapter.initialize?.([mockPostsCollection]);

		// Should be able to query the table without error
		const docs = await adapter.find('posts', {});
		expect(docs).toEqual([]);
	});

	describe('CRUD operations', () => {
		let adapter: ReturnType<typeof sqliteAdapter>;

		beforeEach(async () => {
			adapter = sqliteAdapter({ filename: TEST_DB_PATH });
			await adapter.initialize?.([mockPostsCollection]);
		});

		it('should create a document', async () => {
			const doc = await adapter.create('posts', {
				title: 'Test Post',
				content: 'Hello World',
			});

			expect(doc.id).toBeDefined();
			expect(doc.title).toBe('Test Post');
			expect(doc.content).toBe('Hello World');
			expect(doc.createdAt).toBeDefined();
			expect(doc.updatedAt).toBeDefined();
		});

		it('should find all documents', async () => {
			await adapter.create('posts', { title: 'Post 1', content: 'Content 1' });
			await adapter.create('posts', { title: 'Post 2', content: 'Content 2' });

			const docs = await adapter.find('posts', {});

			expect(docs).toHaveLength(2);
			expect(docs[0]['title']).toBe('Post 1');
			expect(docs[1]['title']).toBe('Post 2');
		});

		it('should find document by id', async () => {
			const created = await adapter.create('posts', {
				title: 'Find Me',
				content: 'Content',
			});

			const found = await adapter.findById('posts', created.id as string);

			expect(found).not.toBeNull();
			expect(found?.['title']).toBe('Find Me');
		});

		it('should return null for non-existent id', async () => {
			const found = await adapter.findById('posts', 'nonexistent');
			expect(found).toBeNull();
		});

		it('should update a document', async () => {
			const created = await adapter.create('posts', {
				title: 'Original',
				content: 'Original content',
			});

			// Small delay to ensure different timestamp
			await new Promise((resolve) => setTimeout(resolve, 10));

			const updated = await adapter.update('posts', created.id as string, {
				title: 'Updated',
			});

			expect(updated.title).toBe('Updated');
			expect(updated.content).toBe('Original content');
			expect(updated.updatedAt).not.toBe(created.updatedAt);
		});

		it('should delete a document', async () => {
			const created = await adapter.create('posts', {
				title: 'Delete Me',
				content: 'Content',
			});

			const deleted = await adapter.delete('posts', created.id as string);
			expect(deleted).toBe(true);

			const found = await adapter.findById('posts', created.id as string);
			expect(found).toBeNull();
		});

		it('should return false when deleting non-existent document', async () => {
			const deleted = await adapter.delete('posts', 'nonexistent');
			expect(deleted).toBe(false);
		});
	});

	describe('query options', () => {
		let adapter: ReturnType<typeof sqliteAdapter>;

		beforeEach(async () => {
			adapter = sqliteAdapter({ filename: TEST_DB_PATH });
			await adapter.initialize?.([mockPostsCollection]);

			// Create test data
			for (let i = 1; i <= 10; i++) {
				await adapter.create('posts', {
					title: `Post ${i}`,
					content: `Content ${i}`,
				});
			}
		});

		it('should limit results', async () => {
			const docs = await adapter.find('posts', { limit: 5 });
			expect(docs).toHaveLength(5);
		});

		it('should paginate results', async () => {
			const page1 = await adapter.find('posts', { limit: 3, page: 1 });
			const page2 = await adapter.find('posts', { limit: 3, page: 2 });

			expect(page1).toHaveLength(3);
			expect(page2).toHaveLength(3);
			expect(page1[0]['title']).toBe('Post 1');
			expect(page2[0]['title']).toBe('Post 4');
		});
	});

	describe('Soft Delete', () => {
		const softDeleteCollection: CollectionConfig = {
			slug: 'articles',
			fields: [{ name: 'title', type: 'text', required: true, label: 'Title' }],
			softDelete: true,
			timestamps: true,
		};

		let adapter: ReturnType<typeof sqliteAdapter>;

		beforeEach(async () => {
			adapter = sqliteAdapter({ filename: TEST_DB_PATH });
			await adapter.initialize?.([softDeleteCollection]);
		});

		it('should create deletedAt column for soft-delete collections', async () => {
			const doc = await adapter.create('articles', { title: 'Test Article' });
			const fetched = await adapter.findById('articles', doc.id as string);
			expect(fetched).toBeTruthy();
			expect(fetched?.['deletedAt']).toBeNull();
		});

		it('should soft delete a document by setting deletedAt', async () => {
			const doc = await adapter.create('articles', { title: 'To Delete' });
			const id = doc.id as string;

			const result = await adapter.softDelete?.('articles', id);
			expect(result).toBe(true);

			// Verify deletedAt is set
			const found = await adapter.findById('articles', id);
			expect(found).toBeTruthy();
			expect(found?.['deletedAt']).toBeTruthy();
		});

		it('should restore a soft-deleted document', async () => {
			const doc = await adapter.create('articles', { title: 'To Restore' });
			const id = doc.id as string;

			await adapter.softDelete?.('articles', id);
			const restored = await adapter.restore?.('articles', id);

			expect(restored['deletedAt']).toBeNull();
			expect(restored['title']).toBe('To Restore');
		});

		it('should filter out soft-deleted docs with null where clause', async () => {
			await adapter.create('articles', { title: 'Active' });
			const toDelete = await adapter.create('articles', { title: 'Deleted' });
			await adapter.softDelete?.('articles', toDelete.id as string);

			// Find with deletedAt: null should only return active docs
			const activeDocs = await adapter.find('articles', { deletedAt: null });
			expect(activeDocs).toHaveLength(1);
			expect(activeDocs[0]['title']).toBe('Active');
		});

		it('should find only soft-deleted docs with $ne null', async () => {
			await adapter.create('articles', { title: 'Active' });
			const toDelete = await adapter.create('articles', { title: 'Deleted' });
			await adapter.softDelete?.('articles', toDelete.id as string);

			// Find with deletedAt: { $ne: null } should only return deleted docs
			const deletedDocs = await adapter.find('articles', { deletedAt: { $ne: null } });
			expect(deletedDocs).toHaveLength(1);
			expect(deletedDocs[0]['title']).toBe('Deleted');
		});

		it('should return false when soft-deleting non-existent document', async () => {
			const result = await adapter.softDelete?.('articles', 'nonexistent');
			expect(result).toBe(false);
		});
	});

	describe('comparison operators', () => {
		let adapter: ReturnType<typeof sqliteAdapter>;

		beforeEach(async () => {
			adapter = sqliteAdapter({ filename: TEST_DB_PATH });
			await adapter.initialize?.([mockPostsCollection]);
		});

		it('should filter with $gte operator', async () => {
			await adapter.create('posts', { title: 'Old Post' });
			await adapter.create('posts', { title: 'New Post' });

			const docs = await adapter.find('posts', { createdAt: { $gte: '2000-01-01T00:00:00.000Z' } });
			expect(docs.length).toBeGreaterThanOrEqual(2);
		});

		it('should filter with $lte operator', async () => {
			await adapter.create('posts', { title: 'Post A' });

			const docs = await adapter.find('posts', { createdAt: { $lte: '2099-12-31T23:59:59.999Z' } });
			expect(docs.length).toBeGreaterThanOrEqual(1);
		});

		it('should filter with $gt operator', async () => {
			await adapter.create('posts', { title: 'Post B' });

			const docs = await adapter.find('posts', { createdAt: { $gt: '2099-01-01T00:00:00.000Z' } });
			expect(docs).toHaveLength(0);
		});

		it('should filter with $lt operator', async () => {
			await adapter.create('posts', { title: 'Post C' });

			const docs = await adapter.find('posts', { createdAt: { $lt: '2000-01-01T00:00:00.000Z' } });
			expect(docs).toHaveLength(0);
		});

		it('should combine $gte and $lte for range queries', async () => {
			await adapter.create('posts', { title: 'Range Post' });

			const now = new Date();
			const oneMinuteAgo = new Date(now.getTime() - 60_000).toISOString();
			const oneMinuteFromNow = new Date(now.getTime() + 60_000).toISOString();

			const docs = await adapter.find('posts', {
				createdAt: { $gte: oneMinuteAgo, $lte: oneMinuteFromNow },
			});
			expect(docs.length).toBeGreaterThanOrEqual(1);
			expect(docs.some((d) => d['title'] === 'Range Post')).toBe(true);
		});
	});

	describe('extended operators', () => {
		let adapter: ReturnType<typeof sqliteAdapter>;

		beforeEach(async () => {
			adapter = sqliteAdapter({ filename: TEST_DB_PATH });
			await adapter.initialize?.([mockPostsCollection]);
		});

		it('should filter with $ne operator (not equals)', async () => {
			await adapter.create('posts', { title: 'Keep Me' });
			await adapter.create('posts', { title: 'Exclude Me' });

			const docs = await adapter.find('posts', { title: { $ne: 'Exclude Me' } });
			expect(docs.every((d) => d['title'] !== 'Exclude Me')).toBe(true);
			expect(docs.some((d) => d['title'] === 'Keep Me')).toBe(true);
		});

		it('should still handle $ne with null as IS NOT NULL', async () => {
			await adapter.create('posts', { title: 'Has Title' });
			await adapter.create('posts', { title: 'Also Has Title' });

			const docs = await adapter.find('posts', { title: { $ne: null } });
			expect(docs.length).toBeGreaterThanOrEqual(2);
		});

		it('should filter with $like operator', async () => {
			await adapter.create('posts', { title: 'Hello World' });
			await adapter.create('posts', { title: 'Goodbye World' });
			await adapter.create('posts', { title: 'Nothing Here' });

			const docs = await adapter.find('posts', { title: { $like: '%World' } });
			expect(docs).toHaveLength(2);
			expect(docs.every((d) => String(d['title']).endsWith('World'))).toBe(true);
		});

		it('should filter with $contains operator (auto-wraps with %)', async () => {
			await adapter.create('posts', { title: 'First Alpha Post' });
			await adapter.create('posts', { title: 'Second Beta Post' });
			await adapter.create('posts', { title: 'Third Alpha Post' });

			const docs = await adapter.find('posts', { title: { $contains: 'Alpha' } });
			expect(docs).toHaveLength(2);
			expect(docs.every((d) => String(d['title']).includes('Alpha'))).toBe(true);
		});

		it('should filter with $in operator', async () => {
			await adapter.create('posts', { title: 'Apple' });
			await adapter.create('posts', { title: 'Banana' });
			await adapter.create('posts', { title: 'Cherry' });

			const docs = await adapter.find('posts', { title: { $in: ['Apple', 'Cherry'] } });
			expect(docs).toHaveLength(2);
			expect(docs.map((d) => d['title']).sort()).toEqual(['Apple', 'Cherry']);
		});

		it('should filter with $nin operator (not in)', async () => {
			await adapter.create('posts', { title: 'Dog' });
			await adapter.create('posts', { title: 'Cat' });
			await adapter.create('posts', { title: 'Bird' });

			const docs = await adapter.find('posts', { title: { $nin: ['Dog', 'Cat'] } });
			expect(docs.every((d) => d['title'] !== 'Dog' && d['title'] !== 'Cat')).toBe(true);
			expect(docs.some((d) => d['title'] === 'Bird')).toBe(true);
		});

		it('should filter with $exists: true (IS NOT NULL)', async () => {
			await adapter.create('posts', { title: 'Has Content', content: 'Some text' });
			await adapter.create('posts', { title: 'No Content' });

			const docs = await adapter.find('posts', { content: { $exists: true } });
			expect(docs.length).toBeGreaterThanOrEqual(1);
			expect(docs.every((d) => d['content'] != null)).toBe(true);
			expect(docs.some((d) => d['title'] === 'Has Content')).toBe(true);
			expect(docs.every((d) => d['title'] !== 'No Content')).toBe(true);
		});

		it('should filter with $exists: false (IS NULL)', async () => {
			await adapter.create('posts', { title: 'Has Content', content: 'Some text' });
			await adapter.create('posts', { title: 'No Content' });

			const docs = await adapter.find('posts', { content: { $exists: false } });
			expect(docs.length).toBeGreaterThanOrEqual(1);
			expect(docs.every((d) => d['content'] == null)).toBe(true);
			expect(docs.some((d) => d['title'] === 'No Content')).toBe(true);
		});

		it('should throw for $in with empty array', async () => {
			await expect(adapter.find('posts', { title: { $in: [] } })).rejects.toThrow(
				'non-empty array',
			);
		});

		it('should throw for $nin with empty array', async () => {
			await expect(adapter.find('posts', { title: { $nin: [] } })).rejects.toThrow(
				'non-empty array',
			);
		});

		it('should combine extended operators with comparison operators', async () => {
			await adapter.create('posts', { title: 'Alpha' });
			await adapter.create('posts', { title: 'Beta' });
			await adapter.create('posts', { title: 'Gamma' });

			// $ne combined with another operator on different fields
			const now = new Date();
			const oneMinuteFromNow = new Date(now.getTime() + 60_000).toISOString();
			const docs = await adapter.find('posts', {
				title: { $ne: 'Gamma' },
				createdAt: { $lte: oneMinuteFromNow },
			});
			expect(docs.every((d) => d['title'] !== 'Gamma')).toBe(true);
			expect(docs.length).toBeGreaterThanOrEqual(2);
		});

		it('should throw when $in array exceeds 500 elements', async () => {
			const bigArray = Array.from({ length: 501 }, (_, i) => `val${i}`);
			await expect(adapter.find('posts', { title: { $in: bigArray } })).rejects.toThrow(
				/exceeds.*maximum.*500/i,
			);
		});

		it('should allow $in array up to 500 elements', async () => {
			const arr = Array.from({ length: 500 }, (_, i) => `val${i}`);
			// Should not throw (returns 0 results since none match)
			const docs = await adapter.find('posts', { title: { $in: arr } });
			expect(docs).toBeDefined();
		});

		it('should throw when $nin array exceeds 500 elements', async () => {
			const bigArray = Array.from({ length: 501 }, (_, i) => `val${i}`);
			await expect(adapter.find('posts', { title: { $nin: bigArray } })).rejects.toThrow(
				/exceeds.*maximum.*500/i,
			);
		});

		it('should throw when $contains value exceeds 1000 characters', async () => {
			const longStr = 'a'.repeat(1001);
			await expect(adapter.find('posts', { title: { $contains: longStr } })).rejects.toThrow(
				/exceeds.*maximum.*length|pattern.*too long/i,
			);
		});

		it('should throw when $like value exceeds 1000 characters', async () => {
			const longStr = 'a'.repeat(1001);
			await expect(adapter.find('posts', { title: { $like: longStr } })).rejects.toThrow(
				/exceeds.*maximum.*length|pattern.*too long/i,
			);
		});

		it('should allow $contains value up to 1000 characters', async () => {
			const str = 'a'.repeat(1000);
			const docs = await adapter.find('posts', { title: { $contains: str } });
			expect(docs).toBeDefined();
		});
	});

	describe('sort support', () => {
		let adapter: ReturnType<typeof sqliteAdapter>;

		beforeEach(async () => {
			adapter = sqliteAdapter({ filename: TEST_DB_PATH });
			await adapter.initialize?.([mockPostsCollection]);
			await adapter.create('posts', { title: 'Charlie' });
			await adapter.create('posts', { title: 'Alpha' });
			await adapter.create('posts', { title: 'Bravo' });
		});

		it('should sort ascending by field name', async () => {
			const docs = await adapter.find('posts', { sort: 'title' });
			const titles = docs.map((d) => d['title']);
			expect(titles).toEqual(['Alpha', 'Bravo', 'Charlie']);
		});

		it('should sort descending with - prefix', async () => {
			const docs = await adapter.find('posts', { sort: '-title' });
			const titles = docs.map((d) => d['title']);
			expect(titles).toEqual(['Charlie', 'Bravo', 'Alpha']);
		});

		it('should sort with limit', async () => {
			const docs = await adapter.find('posts', { sort: 'title', limit: 2 });
			const titles = docs.map((d) => d['title']);
			expect(titles).toEqual(['Alpha', 'Bravo']);
		});

		it('should sort by createdAt by default', async () => {
			const docs = await adapter.find('posts', {});
			const titles = docs.map((d) => d['title']);
			// Default insertion order
			expect(titles).toEqual(['Charlie', 'Alpha', 'Bravo']);
		});
	});

	describe('OR/AND logical operators', () => {
		let adapter: ReturnType<typeof sqliteAdapter>;

		beforeEach(async () => {
			adapter = sqliteAdapter({ filename: TEST_DB_PATH });
			await adapter.initialize?.([mockPostsCollection]);
			await adapter.create('posts', { title: 'Alpha', content: 'First' });
			await adapter.create('posts', { title: 'Beta', content: 'Second' });
			await adapter.create('posts', { title: 'Gamma', content: 'Third' });
		});

		it('should handle $or — match any condition', async () => {
			const docs = await adapter.find('posts', {
				$or: [{ title: 'Alpha' }, { title: 'Gamma' }],
			});
			const titles = docs.map((d) => d['title']).sort();
			expect(titles).toEqual(['Alpha', 'Gamma']);
		});

		it('should handle $and — match all conditions', async () => {
			const docs = await adapter.find('posts', {
				$and: [{ title: 'Alpha' }, { content: 'First' }],
			});
			expect(docs).toHaveLength(1);
			expect(docs[0]['title']).toBe('Alpha');
		});

		it('should handle nested $or inside $and', async () => {
			const docs = await adapter.find('posts', {
				$and: [
					{ $or: [{ title: 'Alpha' }, { title: 'Beta' }] },
					{ content: { $contains: 'irst' } },
				],
			});
			expect(docs).toHaveLength(1);
			expect(docs[0]['title']).toBe('Alpha');
		});

		it('should combine $or with top-level field conditions', async () => {
			const docs = await adapter.find('posts', {
				content: { $ne: 'Third' },
				$or: [{ title: 'Alpha' }, { title: 'Beta' }],
			});
			const titles = docs.map((d) => d['title']).sort();
			expect(titles).toEqual(['Alpha', 'Beta']);
		});

		it('should return empty when $and conditions are contradictory', async () => {
			const docs = await adapter.find('posts', {
				$and: [{ title: 'Alpha' }, { title: 'Beta' }],
			});
			expect(docs).toHaveLength(0);
		});
	});

	describe('contains case-insensitivity', () => {
		let adapter: ReturnType<typeof sqliteAdapter>;

		beforeEach(async () => {
			adapter = sqliteAdapter({ filename: TEST_DB_PATH });
			await adapter.initialize?.([mockPostsCollection]);
			await adapter.create('posts', { title: 'Hello World' });
			await adapter.create('posts', { title: 'HELLO WORLD' });
			await adapter.create('posts', { title: 'hello world' });
		});

		it('should match $contains case-insensitively', async () => {
			const docs = await adapter.find('posts', { title: { $contains: 'hello' } });
			expect(docs).toHaveLength(3);
		});

		it('should match $contains case-insensitively with uppercase query', async () => {
			const docs = await adapter.find('posts', { title: { $contains: 'HELLO' } });
			expect(docs).toHaveLength(3);
		});
	});

	describe('nested/dot-notation field queries', () => {
		let adapter: ReturnType<typeof sqliteAdapter>;

		beforeEach(async () => {
			adapter = sqliteAdapter({ filename: TEST_DB_PATH });
			await adapter.initialize?.([mockProductsCollection]);
			await adapter.create('products', {
				name: 'Widget',
				metadata: JSON.stringify({ color: 'blue', size: 10 }),
			});
			await adapter.create('products', {
				name: 'Gadget',
				metadata: JSON.stringify({ color: 'red', size: 20 }),
			});
			await adapter.create('products', {
				name: 'Doohickey',
				metadata: JSON.stringify({ color: 'blue', size: 30 }),
			});
		});

		it('should filter by nested field using dot notation', async () => {
			const docs = await adapter.find('products', { 'metadata.color': 'blue' });
			expect(docs).toHaveLength(2);
			expect(docs.map((d) => d['name']).sort()).toEqual(['Doohickey', 'Widget']);
		});

		it('should filter by nested field with operator', async () => {
			const docs = await adapter.find('products', {
				'metadata.size': { $gt: 15 },
			});
			expect(docs).toHaveLength(2);
			expect(docs.map((d) => d['name']).sort()).toEqual(['Doohickey', 'Gadget']);
		});

		it('should return empty for non-matching nested value', async () => {
			const docs = await adapter.find('products', { 'metadata.color': 'green' });
			expect(docs).toHaveLength(0);
		});
	});

	describe('relationship JOIN queries ($joins)', () => {
		const categoriesCollection: CollectionConfig = {
			slug: 'categories',
			labels: { singular: 'Category', plural: 'Categories' },
			fields: [
				{ name: 'name', type: 'text', required: true },
				{ name: 'priority', type: 'number' },
			],
		};

		const articlesCollection: CollectionConfig = {
			slug: 'articles',
			labels: { singular: 'Article', plural: 'Articles' },
			fields: [
				{ name: 'title', type: 'text', required: true },
				{ name: 'category', type: 'text' }, // stores category ID
			],
		};

		let adapter: ReturnType<typeof sqliteAdapter>;

		beforeEach(async () => {
			adapter = sqliteAdapter({ filename: TEST_DB_PATH });
			await adapter.initialize?.([categoriesCollection, articlesCollection]);

			// Create categories and capture generated IDs
			const cat1 = await adapter.create('categories', { name: 'Technology', priority: 1 });
			const cat2 = await adapter.create('categories', { name: 'Science', priority: 2 });
			await adapter.create('categories', { name: 'Art', priority: 3 });

			// Create articles linked to categories via real IDs
			await adapter.create('articles', { title: 'AI Revolution', category: cat1['id'] });
			await adapter.create('articles', { title: 'Quantum Physics', category: cat2['id'] });
			await adapter.create('articles', { title: 'Tech Trends', category: cat1['id'] });
		});

		it('should filter by related collection field using $joins', async () => {
			const docs = await adapter.find('articles', {
				$joins: [
					{
						targetTable: 'categories',
						localField: 'category',
						targetField: 'id',
						conditions: { name: 'Technology' },
					},
				],
			});
			expect(docs).toHaveLength(2);
			expect(docs.map((d) => d['title']).sort()).toEqual(['AI Revolution', 'Tech Trends']);
		});

		it('should filter by related field with operator in $joins', async () => {
			const docs = await adapter.find('articles', {
				$joins: [
					{
						targetTable: 'categories',
						localField: 'category',
						targetField: 'id',
						conditions: { name: { $contains: 'sci' } },
					},
				],
			});
			expect(docs).toHaveLength(1);
			expect(docs[0]['title']).toBe('Quantum Physics');
		});

		it('should combine $joins with normal where conditions', async () => {
			const docs = await adapter.find('articles', {
				title: { $contains: 'revolution' },
				$joins: [
					{
						targetTable: 'categories',
						localField: 'category',
						targetField: 'id',
						conditions: { name: 'Technology' },
					},
				],
			});
			expect(docs).toHaveLength(1);
			expect(docs[0]['title']).toBe('AI Revolution');
		});

		it('should return empty when JOIN conditions match no related docs', async () => {
			const docs = await adapter.find('articles', {
				$joins: [
					{
						targetTable: 'categories',
						localField: 'category',
						targetField: 'id',
						conditions: { name: 'Nonexistent' },
					},
				],
			});
			expect(docs).toHaveLength(0);
		});

		it('should reject $joins with invalid targetField', async () => {
			await expect(
				adapter.find('articles', {
					$joins: [
						{
							targetTable: 'categories',
							localField: 'category',
							targetField: 'id" OR 1=1) --',
							conditions: {},
						},
					],
				}),
			).rejects.toThrow(/Invalid column name/);
		});

		it('should accept $joins with valid targetField', async () => {
			const docs = await adapter.find('articles', {
				$joins: [
					{
						targetTable: 'categories',
						localField: 'category',
						targetField: 'id',
						conditions: { name: 'Technology' },
					},
				],
			});
			expect(docs.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe('$contains LIKE wildcard escaping', () => {
		let adapter: ReturnType<typeof sqliteAdapter>;

		beforeEach(async () => {
			adapter = sqliteAdapter({ filename: TEST_DB_PATH });
			await adapter.initialize?.([mockPostsCollection]);
			await adapter.create('posts', { title: 'Normal Post' });
			await adapter.create('posts', { title: '100% Discount' });
			await adapter.create('posts', { title: 'Under_score Title' });
		});

		it('should match literal % character without matching everything', async () => {
			const docs = await adapter.find('posts', { title: { $contains: '%' } });
			// Should match only "100% Discount", not all rows
			expect(docs).toHaveLength(1);
			expect(docs[0]['title']).toBe('100% Discount');
		});

		it('should match literal _ character without matching single-char wildcard', async () => {
			const docs = await adapter.find('posts', { title: { $contains: '_' } });
			// Should match only "Under_score Title"
			expect(docs).toHaveLength(1);
			expect(docs[0]['title']).toBe('Under_score Title');
		});

		it('should still match normal substring without wildcards', async () => {
			const docs = await adapter.find('posts', { title: { $contains: 'Normal' } });
			expect(docs).toHaveLength(1);
			expect(docs[0]['title']).toBe('Normal Post');
		});
	});
});
