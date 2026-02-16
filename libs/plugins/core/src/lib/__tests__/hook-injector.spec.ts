import { describe, it, expect, vi } from 'vitest';
import { injectCollectionEventHooks, type CollectionEventListener } from '../hook-injector';
import type { CollectionConfig } from '@momentumcms/core';
import type { CollectionEvent } from '../plugin.types';

function createCollection(slug: string): CollectionConfig {
	return { slug, fields: [] };
}

describe('injectCollectionEventHooks', () => {
	it('should inject afterChange and afterDelete hooks into collections', () => {
		const collections = [createCollection('posts'), createCollection('users')];
		const listener = vi.fn();

		injectCollectionEventHooks(collections, listener);

		expect(collections[0].hooks?.afterChange).toHaveLength(1);
		expect(collections[0].hooks?.afterDelete).toHaveLength(1);
		expect(collections[1].hooks?.afterChange).toHaveLength(1);
		expect(collections[1].hooks?.afterDelete).toHaveLength(1);
	});

	it('should preserve existing hooks', () => {
		const existingHook = vi.fn();
		const collections: CollectionConfig[] = [
			{
				slug: 'posts',
				fields: [],
				hooks: {
					afterChange: [existingHook],
					afterDelete: [existingHook],
				},
			},
		];
		const listener = vi.fn();

		injectCollectionEventHooks(collections, listener);

		expect(collections[0].hooks?.afterChange).toHaveLength(2);
		expect(collections[0].hooks?.afterDelete).toHaveLength(2);
		expect(collections[0].hooks?.afterChange?.[0]).toBe(existingHook);
		expect(collections[0].hooks?.afterDelete?.[0]).toBe(existingHook);
	});

	it('should emit afterChange event with create operation', () => {
		const collections = [createCollection('posts')];
		const events: CollectionEvent[] = [];
		const listener: CollectionEventListener = (event) => events.push(event);

		injectCollectionEventHooks(collections, listener);

		// Simulate afterChange hook call for create
		const hook = collections[0].hooks?.afterChange?.[0];
		hook?.({
			req: {} as CollectionEvent['doc'],
			operation: 'create',
			doc: { id: '1', title: 'Hello' },
		});

		expect(events).toHaveLength(1);
		expect(events[0].collection).toBe('posts');
		expect(events[0].event).toBe('afterChange');
		expect(events[0].operation).toBe('create');
		expect(events[0].doc).toEqual({ id: '1', title: 'Hello' });
		expect(events[0].timestamp).toBeDefined();
	});

	it('should emit afterChange event with update operation', () => {
		const collections = [createCollection('posts')];
		const events: CollectionEvent[] = [];
		const listener: CollectionEventListener = (event) => events.push(event);

		injectCollectionEventHooks(collections, listener);

		const hook = collections[0].hooks?.afterChange?.[0];
		hook?.({
			req: {} as CollectionEvent['doc'],
			operation: 'update',
			doc: { id: '1', title: 'Updated' },
			originalDoc: { id: '1', title: 'Original' },
		});

		expect(events).toHaveLength(1);
		expect(events[0].operation).toBe('update');
		expect(events[0].previousDoc).toEqual({ id: '1', title: 'Original' });
	});

	it('should emit afterDelete event', () => {
		const collections = [createCollection('users')];
		const events: CollectionEvent[] = [];
		const listener: CollectionEventListener = (event) => events.push(event);

		injectCollectionEventHooks(collections, listener);

		const hook = collections[0].hooks?.afterDelete?.[0];
		hook?.({
			req: {} as CollectionEvent['doc'],
			operation: 'delete',
			doc: { id: '42', name: 'John' },
		});

		expect(events).toHaveLength(1);
		expect(events[0].collection).toBe('users');
		expect(events[0].event).toBe('afterDelete');
		expect(events[0].operation).toBe('delete');
		expect(events[0].doc).toEqual({ id: '42', name: 'John' });
	});

	it('should initialize hooks object if not present', () => {
		const collections: CollectionConfig[] = [{ slug: 'bare', fields: [] }];
		const listener = vi.fn();

		injectCollectionEventHooks(collections, listener);

		expect(collections[0].hooks).toBeDefined();
		expect(collections[0].hooks?.afterChange).toHaveLength(1);
		expect(collections[0].hooks?.afterDelete).toHaveLength(1);
	});
});
