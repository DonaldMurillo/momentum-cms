import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildDependencyGraph, injectCacheInvalidationHooks } from '../invalidation';
import type { CollectionConfig, HookFunction } from '@momentumcms/core';
import type { CacheAdapter } from '../cache-adapter.types';

function makeCollection(slug: string, fields: CollectionConfig['fields'] = []): CollectionConfig {
	return {
		slug,
		fields,
		labels: { singular: slug, plural: slug },
	} as CollectionConfig;
}

describe('buildDependencyGraph', () => {
	it('should return empty map for no relationships', () => {
		const collections = [makeCollection('posts', [{ name: 'title', type: 'text' }])];
		const graph = buildDependencyGraph(collections);
		expect(graph.size).toBe(0);
	});

	it('should detect relationship fields', () => {
		const collections = [
			makeCollection('posts', [{ name: 'author', type: 'relationship', relationTo: 'users' }]),
		];
		const graph = buildDependencyGraph(collections);
		expect(graph.get('users')).toEqual(['posts']);
	});

	it('should handle polymorphic relationships', () => {
		const collections = [
			makeCollection('comments', [
				{ name: 'parent', type: 'relationship', relationTo: ['posts', 'pages'] },
			]),
		];
		const graph = buildDependencyGraph(collections);
		expect(graph.get('posts')).toEqual(['comments']);
		expect(graph.get('pages')).toEqual(['comments']);
	});

	it('should handle nested fields in groups', () => {
		const collections = [
			makeCollection('articles', [
				{
					name: 'meta',
					type: 'group',
					fields: [{ name: 'category', type: 'relationship', relationTo: 'categories' }],
				},
			]),
		];
		const graph = buildDependencyGraph(collections);
		expect(graph.get('categories')).toEqual(['articles']);
	});

	it('should handle nested fields in tabs', () => {
		const collections = [
			makeCollection('pages', [
				{
					name: 'content',
					type: 'tabs',
					tabs: [
						{
							label: 'Main',
							fields: [{ name: 'author', type: 'relationship', relationTo: 'users' }],
						},
					],
				},
			] as CollectionConfig['fields']),
		];
		const graph = buildDependencyGraph(collections);
		expect(graph.get('users')).toEqual(['pages']);
	});

	it('should handle nested fields in blocks', () => {
		const collections = [
			makeCollection('pages', [
				{
					name: 'layout',
					type: 'blocks',
					blocks: [
						{
							slug: 'hero',
							fields: [{ name: 'featured', type: 'relationship', relationTo: 'posts' }],
						},
					],
				},
			] as CollectionConfig['fields']),
		];
		const graph = buildDependencyGraph(collections);
		expect(graph.get('posts')).toEqual(['pages']);
	});

	it('should not duplicate dependents', () => {
		const collections = [
			makeCollection('posts', [
				{ name: 'author', type: 'relationship', relationTo: 'users' },
				{ name: 'reviewer', type: 'relationship', relationTo: 'users' },
			]),
		];
		const graph = buildDependencyGraph(collections);
		expect(graph.get('users')).toEqual(['posts']);
	});
});

describe('injectCacheInvalidationHooks', () => {
	let mockAdapter: CacheAdapter;

	beforeEach(() => {
		mockAdapter = {
			get: vi.fn(),
			set: vi.fn(),
			delete: vi.fn(),
			deleteByTag: vi.fn().mockResolvedValue(0),
			clear: vi.fn(),
			stats: vi.fn(),
		};
	});

	it('should inject afterChange and afterDelete hooks', () => {
		const collections = [makeCollection('posts')];
		const graph = new Map<string, string[]>();

		injectCacheInvalidationHooks(collections, mockAdapter, graph, new Set(), undefined, false);

		expect(collections[0]?.hooks?.afterChange).toHaveLength(1);
		expect(collections[0]?.hooks?.afterDelete).toHaveLength(1);
	});

	it('should skip excluded collections', () => {
		const collections = [makeCollection('users')];
		const graph = new Map<string, string[]>();

		injectCacheInvalidationHooks(
			collections,
			mockAdapter,
			graph,
			new Set(['users']),
			undefined,
			false,
		);

		expect(collections[0]?.hooks?.afterChange).toBeUndefined();
	});

	it('should call deleteByTag when hook fires and await invalidation', async () => {
		const collections = [makeCollection('posts')];
		const graph = new Map<string, string[]>();

		injectCacheInvalidationHooks(collections, mockAdapter, graph, new Set(), undefined, false);

		// Simulate hook firing — the hook should return a promise we can await
		const afterChangeHooks = collections[0]?.hooks?.afterChange ?? [];
		expect(afterChangeHooks).toHaveLength(1);
		const hook = afterChangeHooks[0] as HookFunction;
		const result = hook({ doc: {}, operation: 'create' } as Parameters<HookFunction>[0]);

		// The hook must return a Promise so callers can await invalidation
		expect(result).toBeInstanceOf(Promise);
		await result;

		// After awaiting, invalidation must be complete — no race window
		expect(mockAdapter.deleteByTag).toHaveBeenCalledWith('posts');
	});

	it('should cascade invalidation to dependent collections', async () => {
		const collections = [makeCollection('posts')];
		const graph = new Map([['posts', ['comments', 'feeds']]]);

		injectCacheInvalidationHooks(collections, mockAdapter, graph, new Set(), undefined, false);

		const afterChangeHooks = collections[0]?.hooks?.afterChange ?? [];
		expect(afterChangeHooks).toHaveLength(1);
		const hook = afterChangeHooks[0] as HookFunction;

		// Await the hook — invalidation must complete before the promise resolves
		await hook({ doc: {}, operation: 'update' } as Parameters<HookFunction>[0]);

		expect(mockAdapter.deleteByTag).toHaveBeenCalledWith('posts');
		expect(mockAdapter.deleteByTag).toHaveBeenCalledWith('comments');
		expect(mockAdapter.deleteByTag).toHaveBeenCalledWith('feeds');
	});

	it('should inject invalidation hooks for globals', () => {
		const globalConfigs = [{ slug: 'settings' }, { slug: 'navigation' }];
		const collections = [makeCollection('posts')];
		const graph = new Map<string, string[]>();

		injectCacheInvalidationHooks(
			collections,
			mockAdapter,
			graph,
			new Set(),
			undefined,
			false,
			globalConfigs,
		);

		// Collections should still get hooks
		expect(collections[0]?.hooks?.afterChange).toHaveLength(1);
	});

	it('should call deleteByTag for global when global hook fires', async () => {
		const globalConfigs = [{ slug: 'settings' }];
		const collections: CollectionConfig[] = [];
		const graph = new Map<string, string[]>();

		const result = injectCacheInvalidationHooks(
			collections,
			mockAdapter,
			graph,
			new Set(),
			undefined,
			false,
			globalConfigs,
		);

		// The result should include a global invalidation function
		expect(result?.invalidateGlobal).toBeDefined();
		await result?.invalidateGlobal?.('settings');

		expect(mockAdapter.deleteByTag).toHaveBeenCalledWith('global:settings');
	});

	it('should preserve existing hooks', () => {
		const existingHook = vi.fn();
		const collections = [
			{
				...makeCollection('posts'),
				hooks: { afterChange: [existingHook] },
			},
		];
		const graph = new Map<string, string[]>();

		injectCacheInvalidationHooks(collections, mockAdapter, graph, new Set(), undefined, false);

		expect(collections[0]?.hooks?.afterChange).toHaveLength(2);
		expect(collections[0]?.hooks?.afterChange?.[0]).toBe(existingHook);
	});
});
