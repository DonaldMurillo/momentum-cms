import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { AdminComponentRegistry } from '../admin-component-registry.service';
import { AdminSlotRegistry } from '../admin-slot-registry.service';
import {
	provideAdminComponent,
	provideAdminSlot,
	registerConfigComponents,
} from '../provide-admin-components';
import type { AdminComponentsConfig, CollectionConfig } from '@momentumcms/core';

@Component({ template: 'custom-dashboard' })
class CustomDashboard {}

@Component({ template: 'custom-list' })
class CustomList {}

@Component({ template: 'banner' })
class BannerComponent {}

@Component({ template: 'footer' })
class FooterComponent {}

@Component({ template: 'articles-filter' })
class ArticlesFilter {}

describe('provideAdminComponent', () => {
	it('should register a component in AdminComponentRegistry and resolve the correct loader', async () => {
		const loader = () => Promise.resolve(CustomDashboard);
		TestBed.configureTestingModule({
			providers: [provideAdminComponent('dashboard', loader)],
		});
		const registry = TestBed.inject(AdminComponentRegistry);
		expect(registry.has('dashboard')).toBe(true);
		const registeredLoader = registry.get('dashboard');
		if (!registeredLoader) throw new Error('Expected loader to be registered');
		const resolved = await registeredLoader();
		expect(resolved).toBe(CustomDashboard);
	});
});

describe('provideAdminSlot', () => {
	it('should register a slot loader in AdminSlotRegistry and resolve the correct component', async () => {
		TestBed.configureTestingModule({
			providers: [provideAdminSlot('dashboard:before', () => Promise.resolve(BannerComponent))],
		});
		const registry = TestBed.inject(AdminSlotRegistry);
		expect(registry.has('dashboard:before')).toBe(true);
		const loaders = registry.getAll('dashboard:before');
		expect(loaders).toHaveLength(1);
		const resolved = await loaders[0]();
		expect(resolved).toBe(BannerComponent);
	});

	it('should accumulate multiple loaders for the same slot and resolve each correctly', async () => {
		TestBed.configureTestingModule({
			providers: [
				provideAdminSlot('dashboard:before', () => Promise.resolve(BannerComponent)),
				provideAdminSlot('dashboard:before', () => Promise.resolve(FooterComponent)),
			],
		});
		const registry = TestBed.inject(AdminSlotRegistry);
		const loaders = registry.getAll('dashboard:before');
		expect(loaders).toHaveLength(2);
		const [first, second] = await Promise.all(loaders.map((l) => l()));
		expect(first).toBe(BannerComponent);
		expect(second).toBe(FooterComponent);
	});
});

describe('registerConfigComponents', () => {
	let componentRegistry: AdminComponentRegistry;
	let slotRegistry: AdminSlotRegistry;

	beforeEach(() => {
		TestBed.configureTestingModule({});
		componentRegistry = TestBed.inject(AdminComponentRegistry);
		slotRegistry = TestBed.inject(AdminSlotRegistry);
	});

	it('should register global page overrides from AdminComponentsConfig', () => {
		const adminComponents: AdminComponentsConfig = {
			dashboard: () => Promise.resolve(CustomDashboard),
		};
		registerConfigComponents([], adminComponents, componentRegistry, slotRegistry);
		expect(componentRegistry.has('dashboard')).toBe(true);
	});

	it('should register global slot overrides from AdminComponentsConfig', () => {
		const adminComponents: AdminComponentsConfig = {
			beforeDashboard: () => Promise.resolve(BannerComponent),
			afterDashboard: () => Promise.resolve(FooterComponent),
			header: () => Promise.resolve(BannerComponent),
			footer: () => Promise.resolve(FooterComponent),
			beforeNavigation: () => Promise.resolve(BannerComponent),
			afterNavigation: () => Promise.resolve(FooterComponent),
			beforeLogin: () => Promise.resolve(BannerComponent),
			afterLogin: () => Promise.resolve(FooterComponent),
		};
		registerConfigComponents([], adminComponents, componentRegistry, slotRegistry);
		expect(slotRegistry.has('dashboard:before')).toBe(true);
		expect(slotRegistry.has('dashboard:after')).toBe(true);
		expect(slotRegistry.has('shell:header')).toBe(true);
		expect(slotRegistry.has('shell:footer')).toBe(true);
		expect(slotRegistry.has('shell:nav-start')).toBe(true);
		expect(slotRegistry.has('shell:nav-end')).toBe(true);
		expect(slotRegistry.has('login:before')).toBe(true);
		expect(slotRegistry.has('login:after')).toBe(true);
	});

	it('should register per-collection page overrides from CollectionConfig', () => {
		const collections = [
			{
				slug: 'articles',
				fields: [],
				admin: {
					components: {
						list: () => Promise.resolve(CustomList),
					},
				},
			},
		] as CollectionConfig[];
		registerConfigComponents(collections, undefined, componentRegistry, slotRegistry);
		expect(componentRegistry.has('collections/articles/list')).toBe(true);
	});

	it('should register per-collection slot overrides from CollectionConfig', () => {
		const collections = [
			{
				slug: 'articles',
				fields: [],
				admin: {
					components: {
						beforeList: () => Promise.resolve(ArticlesFilter),
					},
				},
			},
		] as CollectionConfig[];
		registerConfigComponents(collections, undefined, componentRegistry, slotRegistry);
		expect(slotRegistry.has('collection-list:before:articles')).toBe(true);
	});

	it('should handle missing config gracefully', () => {
		registerConfigComponents([], undefined, componentRegistry, slotRegistry);
		// Should not throw and registries should be empty
		expect(componentRegistry.has('dashboard')).toBe(false);
	});

	it('should handle collections without admin.components', () => {
		const collections = [{ slug: 'posts', fields: [] }] as CollectionConfig[];
		registerConfigComponents(collections, undefined, componentRegistry, slotRegistry);
		expect(componentRegistry.has('collections/posts/list')).toBe(false);
	});

	it('should register login and media page overrides', () => {
		const adminComponents: AdminComponentsConfig = {
			login: () => Promise.resolve(CustomDashboard),
			media: () => Promise.resolve(CustomList),
		};
		registerConfigComponents([], adminComponents, componentRegistry, slotRegistry);
		expect(componentRegistry.has('login')).toBe(true);
		expect(componentRegistry.has('media')).toBe(true);
	});

	it('should register per-collection edit and view overrides', () => {
		const collections = [
			{
				slug: 'articles',
				fields: [],
				admin: {
					components: {
						edit: () => Promise.resolve(CustomList),
						view: () => Promise.resolve(CustomDashboard),
						beforeEdit: () => Promise.resolve(BannerComponent),
						afterEdit: () => Promise.resolve(FooterComponent),
						editSidebar: () => Promise.resolve(ArticlesFilter),
						beforeView: () => Promise.resolve(BannerComponent),
						afterView: () => Promise.resolve(FooterComponent),
					},
				},
			},
		] as CollectionConfig[];
		registerConfigComponents(collections, undefined, componentRegistry, slotRegistry);
		expect(componentRegistry.has('collections/articles/edit')).toBe(true);
		expect(componentRegistry.has('collections/articles/view')).toBe(true);
		expect(slotRegistry.has('collection-edit:before:articles')).toBe(true);
		expect(slotRegistry.has('collection-edit:after:articles')).toBe(true);
		expect(slotRegistry.has('collection-edit:sidebar:articles')).toBe(true);
		expect(slotRegistry.has('collection-view:before:articles')).toBe(true);
		expect(slotRegistry.has('collection-view:after:articles')).toBe(true);
	});
});
