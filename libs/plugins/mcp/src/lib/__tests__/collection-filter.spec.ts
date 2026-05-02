import { describe, it, expect } from 'vitest';
import { createCollectionFilter, createGlobalFilter } from '../collection-filter';
import type { CollectionConfig, GlobalConfig } from '@momentumcms/core';

function makeCollection(slug: string, opts?: Partial<CollectionConfig>): CollectionConfig {
	return { slug, fields: [], ...opts } as CollectionConfig;
}

function makeGlobal(slug: string): GlobalConfig {
	return { slug, fields: [] } as unknown as GlobalConfig;
}

describe('createCollectionFilter', () => {
	it('should allow all collections when both lists are empty', () => {
		const collections = [makeCollection('posts'), makeCollection('products')];
		const isAllowed = createCollectionFilter(collections, [], []);
		expect(isAllowed('posts')).toBe(true);
		expect(isAllowed('products')).toBe(true);
	});

	it('should restrict to allowedCollections when provided', () => {
		const collections = [makeCollection('posts'), makeCollection('products')];
		const isAllowed = createCollectionFilter(collections, ['posts'], []);
		expect(isAllowed('posts')).toBe(true);
		expect(isAllowed('products')).toBe(false);
	});

	it('should exclude deniedCollections', () => {
		const collections = [
			makeCollection('posts'),
			makeCollection('products'),
			makeCollection('secrets'),
		];
		const isAllowed = createCollectionFilter(collections, [], ['secrets']);
		expect(isAllowed('posts')).toBe(true);
		expect(isAllowed('products')).toBe(true);
		expect(isAllowed('secrets')).toBe(false);
	});

	it('should apply both allowed and denied (denied wins over allowed)', () => {
		const collections = [makeCollection('posts'), makeCollection('products')];
		const isAllowed = createCollectionFilter(collections, ['posts', 'products'], ['products']);
		expect(isAllowed('posts')).toBe(true);
		expect(isAllowed('products')).toBe(false);
	});

	it('should auto-exclude auth collections (slug starting with "auth-")', () => {
		const collections = [
			makeCollection('posts'),
			makeCollection('auth-user'),
			makeCollection('auth-session'),
			makeCollection('auth-account'),
			makeCollection('auth-verification'),
			makeCollection('auth-api-keys'),
		];
		const isAllowed = createCollectionFilter(collections, [], []);
		expect(isAllowed('posts')).toBe(true);
		expect(isAllowed('auth-user')).toBe(false);
		expect(isAllowed('auth-session')).toBe(false);
		expect(isAllowed('auth-account')).toBe(false);
		expect(isAllowed('auth-verification')).toBe(false);
		expect(isAllowed('auth-api-keys')).toBe(false);
	});

	it('should return false for unknown collection slugs', () => {
		const collections = [makeCollection('posts')];
		const isAllowed = createCollectionFilter(collections, [], []);
		expect(isAllowed('nonexistent')).toBe(false);
	});

	it('should be case-sensitive', () => {
		const collections = [makeCollection('Posts')];
		const isAllowed = createCollectionFilter(collections, [], []);
		expect(isAllowed('Posts')).toBe(true);
		expect(isAllowed('posts')).toBe(false);
	});
});

describe('createGlobalFilter', () => {
	it('should allow all globals when both lists are empty', () => {
		const globals = [makeGlobal('site-settings'), makeGlobal('navigation')];
		const isAllowed = createGlobalFilter(globals, [], []);
		expect(isAllowed('site-settings')).toBe(true);
		expect(isAllowed('navigation')).toBe(true);
	});

	it('should restrict to allowedGlobals when provided', () => {
		const globals = [makeGlobal('site-settings'), makeGlobal('navigation')];
		const isAllowed = createGlobalFilter(globals, ['navigation'], []);
		expect(isAllowed('site-settings')).toBe(false);
		expect(isAllowed('navigation')).toBe(true);
	});

	it('should exclude deniedGlobals', () => {
		const globals = [makeGlobal('site-settings'), makeGlobal('site-secrets')];
		const isAllowed = createGlobalFilter(globals, [], ['site-secrets']);
		expect(isAllowed('site-settings')).toBe(true);
		expect(isAllowed('site-secrets')).toBe(false);
	});

	it('should apply denied over allowed (denied wins)', () => {
		const globals = [makeGlobal('site-settings'), makeGlobal('site-secrets')];
		const isAllowed = createGlobalFilter(
			globals,
			['site-settings', 'site-secrets'],
			['site-secrets'],
		);
		expect(isAllowed('site-settings')).toBe(true);
		expect(isAllowed('site-secrets')).toBe(false);
	});

	it('should return false for unknown global slugs', () => {
		const globals = [makeGlobal('site-settings')];
		const isAllowed = createGlobalFilter(globals, [], []);
		expect(isAllowed('nonexistent')).toBe(false);
	});

	it('should be case-sensitive', () => {
		const globals = [makeGlobal('SiteSettings')];
		const isAllowed = createGlobalFilter(globals, [], []);
		expect(isAllowed('SiteSettings')).toBe(true);
		expect(isAllowed('sitesettings')).toBe(false);
	});
});
