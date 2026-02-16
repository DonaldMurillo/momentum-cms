import { describe, it, expect, vi } from 'vitest';
import { injectCollectionCollector } from '../collectors/collection-collector';
import type { AnalyticsEvent } from '../analytics-event.types';
import type { CollectionConfig, HookFunction } from '@momentumcms/core';

function makeCollection(slug: string, hooks?: CollectionConfig['hooks']): CollectionConfig {
	return {
		slug,
		fields: [],
		hooks,
	} as CollectionConfig;
}

describe('injectCollectionCollector', () => {
	it('should inject afterChange and afterDelete hooks', () => {
		const collections = [makeCollection('posts')];
		const emitter = vi.fn();

		injectCollectionCollector(collections, emitter);

		expect(collections[0].hooks?.afterChange).toHaveLength(1);
		expect(collections[0].hooks?.afterDelete).toHaveLength(1);
	});

	it('should preserve existing hooks', () => {
		const existingHook: HookFunction = vi.fn();
		const collections = [
			makeCollection('posts', {
				afterChange: [existingHook],
				afterDelete: [existingHook],
			}),
		];
		const emitter = vi.fn();

		injectCollectionCollector(collections, emitter);

		expect(collections[0].hooks?.afterChange).toHaveLength(2);
		expect(collections[0].hooks?.afterDelete).toHaveLength(2);
		expect(collections[0].hooks?.afterChange?.[0]).toBe(existingHook);
		expect(collections[0].hooks?.afterDelete?.[0]).toBe(existingHook);
	});

	it('should emit content_created event on create operation', () => {
		const collections = [makeCollection('posts')];
		const emitter = vi.fn<(event: AnalyticsEvent) => void>();

		injectCollectionCollector(collections, emitter);

		const hook = collections[0].hooks!.afterChange![0];
		hook({ operation: 'create', doc: { id: 'doc-1' }, data: {}, collection: collections[0] });

		expect(emitter).toHaveBeenCalledOnce();
		const event = emitter.mock.calls[0][0];
		expect(event.category).toBe('content');
		expect(event.name).toBe('content_created');
		expect(event.context.collection).toBe('posts');
		expect(event.context.operation).toBe('create');
		expect(event.properties['documentId']).toBe('doc-1');
	});

	it('should emit content_updated event on update operation', () => {
		const collections = [makeCollection('articles')];
		const emitter = vi.fn<(event: AnalyticsEvent) => void>();

		injectCollectionCollector(collections, emitter);

		const hook = collections[0].hooks!.afterChange![0];
		hook({ operation: 'update', doc: { id: 'doc-2' }, data: {}, collection: collections[0] });

		const event = emitter.mock.calls[0][0];
		expect(event.name).toBe('content_updated');
		expect(event.context.collection).toBe('articles');
		expect(event.context.operation).toBe('update');
	});

	it('should emit content_deleted event on delete', () => {
		const collections = [makeCollection('posts')];
		const emitter = vi.fn<(event: AnalyticsEvent) => void>();

		injectCollectionCollector(collections, emitter);

		const hook = collections[0].hooks!.afterDelete![0];
		hook({ operation: 'delete', doc: { id: 'doc-3' }, data: {}, collection: collections[0] });

		const event = emitter.mock.calls[0][0];
		expect(event.name).toBe('content_deleted');
		expect(event.context.operation).toBe('delete');
		expect(event.properties['documentId']).toBe('doc-3');
	});

	it('should exclude specified collections', () => {
		const collections = [
			makeCollection('posts'),
			makeCollection('_seed_tracking'),
			makeCollection('users'),
		];
		const emitter = vi.fn();

		injectCollectionCollector(collections, emitter, {
			excludeCollections: ['_seed_tracking'],
		});

		expect(collections[0].hooks?.afterChange).toHaveLength(1);
		expect(collections[1].hooks).toBeUndefined();
		expect(collections[2].hooks?.afterChange).toHaveLength(1);
	});

	it('should inject hooks into multiple collections', () => {
		const collections = [
			makeCollection('posts'),
			makeCollection('users'),
			makeCollection('comments'),
		];
		const emitter = vi.fn();

		injectCollectionCollector(collections, emitter);

		for (const collection of collections) {
			expect(collection.hooks?.afterChange).toHaveLength(1);
			expect(collection.hooks?.afterDelete).toHaveLength(1);
		}
	});

	it('should generate unique event IDs', () => {
		const collections = [makeCollection('posts')];
		const emitter = vi.fn<(event: AnalyticsEvent) => void>();

		injectCollectionCollector(collections, emitter);

		const hook = collections[0].hooks!.afterChange![0];
		hook({ operation: 'create', doc: { id: '1' }, data: {}, collection: collections[0] });
		hook({ operation: 'create', doc: { id: '2' }, data: {}, collection: collections[0] });

		const id1 = emitter.mock.calls[0][0].id;
		const id2 = emitter.mock.calls[1][0].id;
		expect(id1).not.toBe(id2);
	});
});
