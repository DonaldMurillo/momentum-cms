import { describe, it, expect } from 'vitest';
import { SeoSettings } from '../seo-settings-collection';

describe('SeoSettings collection', () => {
	it('should have slug "seo-settings"', () => {
		expect(SeoSettings.slug).toBe('seo-settings');
	});

	it('should be managed (no auto REST routes)', () => {
		expect(SeoSettings.managed).toBe(true);
	});

	it('should be hidden from sidebar', () => {
		expect(SeoSettings.admin?.hidden).toBe(true);
	});

	it('should have robotsRules json field', () => {
		const field = SeoSettings.fields.find((f) => f.name === 'robotsRules');
		expect(field).toBeDefined();
		expect(field?.type).toBe('json');
	});

	it('should have robotsCrawlDelay number field', () => {
		const field = SeoSettings.fields.find((f) => f.name === 'robotsCrawlDelay');
		expect(field).toBeDefined();
		expect(field?.type).toBe('number');
	});

	it('should have robotsAdditionalSitemaps json field', () => {
		const field = SeoSettings.fields.find((f) => f.name === 'robotsAdditionalSitemaps');
		expect(field).toBeDefined();
		expect(field?.type).toBe('json');
	});

	it('should define read/create/update/delete access', () => {
		expect(SeoSettings.access?.read).toBeDefined();
		expect(SeoSettings.access?.create).toBeDefined();
		expect(SeoSettings.access?.update).toBeDefined();
		expect(SeoSettings.access?.delete).toBeDefined();
	});

	it('should allow internal calls (no user) for read access', () => {
		const req = {} as never;
		expect(SeoSettings.access!.read!({ req } as never)).toBe(true);
	});

	it('should allow admin users for read access', () => {
		const req = { user: { role: 'admin' } } as never;
		expect(SeoSettings.access!.read!({ req } as never)).toBe(true);
	});

	it('should deny non-admin users for read access', () => {
		const req = { user: { role: 'user' } } as never;
		expect(SeoSettings.access!.read!({ req } as never)).toBe(false);
	});
});
