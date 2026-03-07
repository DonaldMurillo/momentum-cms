import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { AdminSlotRegistry } from '../admin-slot-registry.service';

@Component({ template: 'banner' })
class BannerComponent {}

@Component({ template: 'footer' })
class FooterComponent {}

@Component({ template: 'articles-filter' })
class ArticlesFilterComponent {}

describe('AdminSlotRegistry', () => {
	let registry: AdminSlotRegistry;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		registry = TestBed.inject(AdminSlotRegistry);
	});

	it('should be provided in root', () => {
		expect(registry).toBeTruthy();
	});

	describe('register / getAll / has', () => {
		it('should register and retrieve slot loaders', () => {
			const loader = () => Promise.resolve(BannerComponent);
			registry.register('dashboard:before', loader);
			expect(registry.has('dashboard:before')).toBe(true);
			expect(registry.getAll('dashboard:before')).toEqual([loader]);
		});

		it('should return empty array for unregistered slots', () => {
			expect(registry.has('dashboard:before')).toBe(false);
			expect(registry.getAll('dashboard:before')).toEqual([]);
		});

		it('should accumulate multiple loaders for the same slot', () => {
			const loader1 = () => Promise.resolve(BannerComponent);
			const loader2 = () => Promise.resolve(FooterComponent);
			registry.register('dashboard:before', loader1);
			registry.register('dashboard:before', loader2);
			const all = registry.getAll('dashboard:before');
			expect(all).toHaveLength(2);
			expect(all[0]).toBe(loader1);
			expect(all[1]).toBe(loader2);
		});
	});

	describe('resolve (merges global + per-collection)', () => {
		it('should return global slot loaders when no per-collection registered', () => {
			const globalLoader = () => Promise.resolve(BannerComponent);
			registry.register('collection-list:before', globalLoader);
			const resolved = registry.resolve('collection-list:before', 'articles');
			expect(resolved).toEqual([globalLoader]);
		});

		it('should return per-collection loaders when no global registered', () => {
			const perCollection = () => Promise.resolve(ArticlesFilterComponent);
			registry.register('collection-list:before:articles', perCollection);
			const resolved = registry.resolve('collection-list:before', 'articles');
			expect(resolved).toEqual([perCollection]);
		});

		it('should merge global and per-collection loaders (global first)', () => {
			const globalLoader = () => Promise.resolve(BannerComponent);
			const perCollection = () => Promise.resolve(ArticlesFilterComponent);
			registry.register('collection-list:before', globalLoader);
			registry.register('collection-list:before:articles', perCollection);
			const resolved = registry.resolve('collection-list:before', 'articles');
			expect(resolved).toEqual([globalLoader, perCollection]);
		});

		it('should not include per-collection loaders from other collections', () => {
			const articlesLoader = () => Promise.resolve(ArticlesFilterComponent);
			registry.register('collection-list:before:articles', articlesLoader);
			const resolved = registry.resolve('collection-list:before', 'categories');
			expect(resolved).toEqual([]);
		});

		it('should resolve without slug (non-collection slots)', () => {
			const loader = () => Promise.resolve(BannerComponent);
			registry.register('dashboard:before', loader);
			const resolved = registry.resolve('dashboard:before');
			expect(resolved).toEqual([loader]);
		});
	});

	describe('idempotent registration', () => {
		it('should not duplicate loaders when the same loader is registered twice', () => {
			const loader = () => Promise.resolve(BannerComponent);
			registry.register('dashboard:before', loader);
			registry.register('dashboard:before', loader);
			expect(registry.getAll('dashboard:before')).toHaveLength(1);
		});
	});
});
