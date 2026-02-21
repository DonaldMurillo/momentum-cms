import { describe, it, expect, vi } from 'vitest';
import { injectSeoAnalysisHooks } from '../seo-analysis-hooks';
import type { CollectionConfig, Field } from '@momentumcms/core';
import type { MomentumAPI } from '@momentumcms/plugins/core';

function makeCollection(
	slug: string,
	hasSeo: boolean,
	hooks?: { afterChange?: Array<() => void> },
): CollectionConfig {
	const fields: Field[] = hasSeo
		? [{ name: 'seo', type: 'group', fields: [] } as unknown as Field]
		: [{ name: 'title', type: 'text' } as unknown as Field];
	return { slug, fields, hooks } as unknown as CollectionConfig;
}

describe('injectSeoAnalysisHooks', () => {
	it('should inject afterChange hook into collections with seo fields', () => {
		const collections = [makeCollection('posts', true)];

		injectSeoAnalysisHooks(collections, {}, () => null);

		expect(collections[0].hooks?.afterChange).toHaveLength(1);
	});

	it('should NOT inject into collections without seo fields', () => {
		const collections = [makeCollection('settings', false)];

		injectSeoAnalysisHooks(collections, {}, () => null);

		expect(collections[0].hooks?.afterChange).toBeUndefined();
	});

	it('should be idempotent', () => {
		const collections = [makeCollection('posts', true)];

		injectSeoAnalysisHooks(collections, {}, () => null);
		injectSeoAnalysisHooks(collections, {}, () => null);

		expect(collections[0].hooks?.afterChange).toHaveLength(1);
	});

	it('should preserve existing afterChange hooks', () => {
		const existingHook = vi.fn();
		const collections = [makeCollection('posts', true, { afterChange: [existingHook] })];

		injectSeoAnalysisHooks(collections, {}, () => null);

		expect(collections[0].hooks?.afterChange).toHaveLength(2);
		expect(collections[0].hooks?.afterChange?.[0]).toBe(existingHook);
	});

	it('hook should not throw when API is unavailable', () => {
		const collections = [makeCollection('posts', true)];

		injectSeoAnalysisHooks(collections, {}, () => null);

		const hook = collections[0].hooks?.afterChange?.[0];
		expect(hook).toBeDefined();
		// Should not throw
		expect(() => hook!({ doc: { id: '1', seo: {} } })).not.toThrow();
	});

	it('hook should not throw when API is available', () => {
		const collections = [makeCollection('posts', true)];
		const mockApi = {
			collection: vi.fn().mockReturnValue({
				find: vi.fn().mockResolvedValue({ docs: [] }),
				create: vi.fn().mockResolvedValue({}),
			}),
			getConfig: vi.fn(),
		} as unknown as MomentumAPI;

		injectSeoAnalysisHooks(collections, {}, () => mockApi);

		const hook = collections[0].hooks?.afterChange?.[0];
		expect(() => hook!({ doc: { id: '1', seo: {} } })).not.toThrow();
	});

	it('hook should trigger analysis creation via API', async () => {
		const collections = [makeCollection('posts', true)];
		const createFn = vi.fn().mockResolvedValue({});
		const findFn = vi.fn().mockResolvedValue({ docs: [] });
		const mockApi = {
			collection: vi.fn().mockReturnValue({
				find: findFn,
				create: createFn,
			}),
			getConfig: vi.fn(),
		} as unknown as MomentumAPI;

		injectSeoAnalysisHooks(collections, {}, () => mockApi);

		const hook = collections[0].hooks?.afterChange?.[0];
		hook!({ doc: { id: 'doc-1', seo: { metaTitle: 'Test' } } });

		// The hook fires async — wait for microtasks to flush
		await vi.waitFor(() => {
			expect(createFn).toHaveBeenCalledTimes(1);
		});

		const createCall = createFn.mock.calls[0][0] as Record<string, unknown>;
		expect(createCall['documentId']).toBe('doc-1');
		expect(createCall['collection']).toBe('posts');
		expect(typeof createCall['score']).toBe('number');
		expect(['good', 'warning', 'poor']).toContain(createCall['grade']);
	});

	it('hook should update existing analysis instead of creating new', async () => {
		const collections = [makeCollection('posts', true)];
		const updateFn = vi.fn().mockResolvedValue({});
		const createFn = vi.fn().mockResolvedValue({});
		const findFn = vi.fn().mockResolvedValue({
			docs: [{ id: 'analysis-1', documentId: 'doc-1', collection: 'posts' }],
		});
		const mockApi = {
			collection: vi.fn().mockReturnValue({
				find: findFn,
				create: createFn,
				update: updateFn,
			}),
			getConfig: vi.fn(),
		} as unknown as MomentumAPI;

		injectSeoAnalysisHooks(collections, {}, () => mockApi);

		const hook = collections[0].hooks?.afterChange?.[0];
		hook!({ doc: { id: 'doc-1', seo: { metaTitle: 'Updated Title' } } });

		await vi.waitFor(() => {
			expect(updateFn).toHaveBeenCalledTimes(1);
		});

		expect(createFn).not.toHaveBeenCalled();
		expect(updateFn).toHaveBeenCalledWith(
			'analysis-1',
			expect.objectContaining({
				documentId: 'doc-1',
				collection: 'posts',
			}),
		);
	});

	it('should respect excludeCollections config', () => {
		const collections = [makeCollection('posts', true), makeCollection('drafts', true)];

		injectSeoAnalysisHooks(collections, { excludeCollections: ['drafts'] }, () => null);

		expect(collections[0].hooks?.afterChange).toHaveLength(1);
		expect(collections[1].hooks?.afterChange).toBeUndefined();
	});
});
