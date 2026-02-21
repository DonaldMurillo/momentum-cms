import { describe, it, expect } from 'vitest';
import {
	getCollectionsFromRouteData,
	getBrandingFromRouteData,
	getGlobalsFromRouteData,
	getPluginRoutesFromRouteData,
} from '../route-data';

const mockCollection = { slug: 'posts', fields: [{ name: 'title', type: 'text' }] };
const mockCollection2 = { slug: 'pages', fields: [{ name: 'body', type: 'richText' }] };

describe('getCollectionsFromRouteData', () => {
	it('should return empty array when data is undefined', () => {
		expect(getCollectionsFromRouteData(undefined)).toEqual([]);
	});

	it('should return empty array when data has no collections', () => {
		expect(getCollectionsFromRouteData({})).toEqual([]);
	});

	it('should return empty array when collections is not an array', () => {
		expect(getCollectionsFromRouteData({ collections: 'invalid' })).toEqual([]);
	});

	it('should return empty array when collections contains non-objects', () => {
		expect(getCollectionsFromRouteData({ collections: ['string', 42, null] })).toEqual([]);
	});

	it('should return empty array when collections contain objects missing slug', () => {
		expect(getCollectionsFromRouteData({ collections: [{ fields: [] }] })).toEqual([]);
	});

	it('should return empty array when collections contain objects missing fields', () => {
		expect(getCollectionsFromRouteData({ collections: [{ slug: 'posts' }] })).toEqual([]);
	});

	it('should return valid collection configs', () => {
		const data = { collections: [mockCollection, mockCollection2] };
		const result = getCollectionsFromRouteData(data);
		expect(result).toHaveLength(2);
		expect(result[0].slug).toBe('posts');
		expect(result[1].slug).toBe('pages');
	});

	it('should reject array when any item is invalid (uses every() check)', () => {
		const data = { collections: [mockCollection, { invalid: true }, mockCollection2] };
		const result = getCollectionsFromRouteData(data);
		// isCollectionConfigArray uses .every() — one bad item fails the whole array
		expect(result).toEqual([]);
	});
});

describe('getBrandingFromRouteData', () => {
	it('should return undefined when data is undefined', () => {
		expect(getBrandingFromRouteData(undefined)).toBeUndefined();
	});

	it('should return undefined when data has no branding', () => {
		expect(getBrandingFromRouteData({})).toBeUndefined();
	});

	it('should return undefined when branding is null', () => {
		expect(getBrandingFromRouteData({ branding: null })).toBeUndefined();
	});

	it('should return branding object with valid properties', () => {
		const data = { branding: { logo: '/logo.svg', title: 'My CMS' } };
		const result = getBrandingFromRouteData(data);
		expect(result).toEqual({ logo: '/logo.svg', title: 'My CMS' });
	});

	it('should return branding with empty object (all optional)', () => {
		const result = getBrandingFromRouteData({ branding: {} });
		expect(result).toEqual({});
	});

	it('should reject branding with invalid logo type', () => {
		const result = getBrandingFromRouteData({ branding: { logo: 42 } });
		expect(result).toBeUndefined();
	});

	it('should reject branding with invalid title type', () => {
		const result = getBrandingFromRouteData({ branding: { title: true } });
		expect(result).toBeUndefined();
	});
});

describe('getGlobalsFromRouteData', () => {
	it('should return empty array when data is undefined', () => {
		expect(getGlobalsFromRouteData(undefined)).toEqual([]);
	});

	it('should return empty array when data has no globals', () => {
		expect(getGlobalsFromRouteData({})).toEqual([]);
	});

	it('should return empty array when globals is not an array', () => {
		expect(getGlobalsFromRouteData({ globals: 'invalid' })).toEqual([]);
	});

	it('should return valid global configs', () => {
		const global = { slug: 'settings', fields: [{ name: 'siteName', type: 'text' }] };
		const result = getGlobalsFromRouteData({ globals: [global] });
		expect(result).toHaveLength(1);
		expect(result[0].slug).toBe('settings');
	});

	it('should filter invalid items from globals array', () => {
		const valid = { slug: 'nav', fields: [] };
		const result = getGlobalsFromRouteData({ globals: [valid, null, 'bad', { noSlug: true }] });
		expect(result).toHaveLength(1);
	});
});

describe('getPluginRoutesFromRouteData', () => {
	it('should return empty array when data is undefined', () => {
		expect(getPluginRoutesFromRouteData(undefined)).toEqual([]);
	});

	it('should return empty array when data has no pluginRoutes', () => {
		expect(getPluginRoutesFromRouteData({})).toEqual([]);
	});

	it('should return empty array when pluginRoutes is not an array', () => {
		expect(getPluginRoutesFromRouteData({ pluginRoutes: 'invalid' })).toEqual([]);
	});

	it('should return plugin routes array as-is', () => {
		const routes = [
			{
				path: 'analytics',
				label: 'Analytics',
				icon: 'heroChart',
				loadComponent: () => Promise.resolve({}),
			},
		];
		const result = getPluginRoutesFromRouteData({ pluginRoutes: routes });
		expect(result).toHaveLength(1);
		expect(result[0].path).toBe('analytics');
	});
});
