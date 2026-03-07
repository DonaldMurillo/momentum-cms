import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { AdminComponentRegistry } from '../admin-component-registry.service';

@Component({ template: 'custom-dashboard' })
class CustomDashboard {}

@Component({ template: 'custom-articles-list' })
class CustomArticlesList {}

@Component({ template: 'custom-list' })
class CustomList {}

describe('AdminComponentRegistry', () => {
	let registry: AdminComponentRegistry;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		registry = TestBed.inject(AdminComponentRegistry);
	});

	it('should be provided in root', () => {
		expect(registry).toBeTruthy();
	});

	describe('register / get / has', () => {
		it('should register and retrieve a component loader', () => {
			const loader = () => Promise.resolve(CustomDashboard);
			registry.register('dashboard', loader);
			expect(registry.has('dashboard')).toBe(true);
			expect(registry.get('dashboard')).toBe(loader);
		});

		it('should return undefined for unregistered keys', () => {
			expect(registry.has('dashboard')).toBe(false);
			expect(registry.get('dashboard')).toBeUndefined();
		});

		it('should allow later registrations to override earlier ones', () => {
			const loader1 = () => Promise.resolve(CustomDashboard);
			const loader2 = () => Promise.resolve(CustomArticlesList);
			registry.register('dashboard', loader1);
			registry.register('dashboard', loader2);
			expect(registry.get('dashboard')).toBe(loader2);
		});
	});

	describe('resolve (per-collection fallback)', () => {
		it('should return per-collection loader when registered', () => {
			const perCollection = () => Promise.resolve(CustomArticlesList);
			const global = () => Promise.resolve(CustomList);
			registry.register('collection-list', global);
			registry.register('collections/articles/list', perCollection);
			expect(registry.resolve('collection-list', 'articles')).toBe(perCollection);
		});

		it('should fall back to global key when per-collection is not registered', () => {
			const global = () => Promise.resolve(CustomList);
			registry.register('collection-list', global);
			expect(registry.resolve('collection-list', 'articles')).toBe(global);
		});

		it('should return undefined when neither per-collection nor global is registered', () => {
			expect(registry.resolve('collection-list', 'articles')).toBeUndefined();
		});

		it('should resolve without slug (non-collection pages)', () => {
			const loader = () => Promise.resolve(CustomDashboard);
			registry.register('dashboard', loader);
			expect(registry.resolve('dashboard')).toBe(loader);
		});
	});
});
