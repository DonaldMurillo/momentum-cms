import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sqliteAdapter } from './db-drizzle';
import { existsSync, unlinkSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { CollectionConfig } from '@momentum-cms/core';

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
});
