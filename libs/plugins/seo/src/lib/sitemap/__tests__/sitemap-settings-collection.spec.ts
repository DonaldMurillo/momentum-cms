import { describe, it, expect } from 'vitest';
import { SeoSitemapSettings } from '../sitemap-settings-collection';
import type { AccessArgs } from '@momentumcms/core';

function buildAccessArgs(user?: { role?: string }): AccessArgs {
	return {
		req: { user: user ? { id: '1', email: 'test@test.com', ...user } : undefined },
	};
}

describe('SeoSitemapSettings collection', () => {
	it('should have slug "seo-sitemap-settings"', () => {
		expect(SeoSitemapSettings.slug).toBe('seo-sitemap-settings');
	});

	it('should be a managed collection (no auto-generated REST routes)', () => {
		expect(SeoSitemapSettings.managed).toBe(true);
	});

	it('should be hidden from sidebar', () => {
		expect(SeoSitemapSettings.admin?.hidden).toBe(true);
	});

	it('should have required fields: collection, includeInSitemap, priority, changeFreq', () => {
		const fieldNames = SeoSitemapSettings.fields.map((f) => f.name);
		expect(fieldNames).toContain('collection');
		expect(fieldNames).toContain('includeInSitemap');
		expect(fieldNames).toContain('priority');
		expect(fieldNames).toContain('changeFreq');
	});

	it('should allow read access for internal calls (no user)', () => {
		const readFn = SeoSitemapSettings.access?.read;
		expect(readFn).toBeDefined();
		expect(readFn?.(buildAccessArgs(undefined))).toBe(true);
	});

	it('should allow read access for admin users', () => {
		const readFn = SeoSitemapSettings.access?.read;
		expect(readFn?.(buildAccessArgs({ role: 'admin' }))).toBe(true);
	});

	it('should deny read access for non-admin users', () => {
		const readFn = SeoSitemapSettings.access?.read;
		expect(readFn?.(buildAccessArgs({ role: 'editor' }))).toBe(false);
	});

	it('should allow create access for internal calls (no user)', () => {
		const createFn = SeoSitemapSettings.access?.create;
		expect(createFn).toBeDefined();
		expect(createFn?.(buildAccessArgs(undefined))).toBe(true);
	});

	it('should allow update access for admin users', () => {
		const updateFn = SeoSitemapSettings.access?.update;
		expect(updateFn).toBeDefined();
		expect(updateFn?.(buildAccessArgs({ role: 'admin' }))).toBe(true);
	});

	it('should deny delete access to unauthenticated requests', () => {
		const deleteFn = SeoSitemapSettings.access?.delete;
		expect(deleteFn).toBeDefined();
		expect(deleteFn?.(buildAccessArgs(undefined))).toBe(false);
	});

	it('should allow delete access to admin users', () => {
		const deleteFn = SeoSitemapSettings.access?.delete;
		expect(deleteFn?.(buildAccessArgs({ role: 'admin' }))).toBe(true);
	});
});
