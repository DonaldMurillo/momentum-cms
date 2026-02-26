import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminSidebarWidget } from '../admin-sidebar.component';
import { McmsThemeService } from '../../../ui/theme/theme.service';
import type { CollectionConfig, GlobalConfig, Field } from '@momentumcms/core';
import type { AdminPluginRoute } from '../../../routes/momentum-admin-routes';
import type { AdminUser } from '../../widget.types';
import type { Type } from '@angular/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCollection(slug: string, overrides?: Partial<CollectionConfig>): CollectionConfig {
	return { slug, fields: [] as Field[], ...overrides };
}

function makeGlobal(slug: string, overrides?: Partial<GlobalConfig>): GlobalConfig {
	return { slug, fields: [] as Field[], ...overrides };
}

function makePluginRoute(path: string, overrides?: Partial<AdminPluginRoute>): AdminPluginRoute {
	return {
		path,
		label: overrides?.label ?? path,
		icon: overrides?.icon ?? 'heroPuzzlePiece',
		loadComponent:
			overrides?.loadComponent ??
			((): Promise<Type<unknown>> => Promise.resolve(class {} as Type<unknown>)),
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('AdminSidebarWidget', () => {
	let fixture: ComponentFixture<AdminSidebarWidget>;
	let component: AdminSidebarWidget;
	let mockThemeService: { toggleTheme: ReturnType<typeof vi.fn>; isDark: ReturnType<typeof vi.fn> };

	beforeEach(() => {
		mockThemeService = {
			toggleTheme: vi.fn(),
			isDark: vi.fn().mockReturnValue(false),
		};

		TestBed.configureTestingModule({
			imports: [AdminSidebarWidget],
			providers: [{ provide: McmsThemeService, useValue: mockThemeService }],
		});

		TestBed.overrideComponent(AdminSidebarWidget, {
			set: { template: '<div></div>', imports: [], providers: [] },
		});

		fixture = TestBed.createComponent(AdminSidebarWidget);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	// ============================================
	// Creation
	// ============================================

	it('should create the component', () => {
		expect(component).toBeTruthy();
	});

	// ============================================
	// collectionsBasePath computed
	// ============================================

	describe('collectionsBasePath', () => {
		it('should default to /admin/collections', () => {
			expect(component.collectionsBasePath()).toBe('/admin/collections');
		});

		it('should reflect a custom basePath', () => {
			fixture.componentRef.setInput('basePath', '/cms');
			fixture.detectChanges();
			expect(component.collectionsBasePath()).toBe('/cms/collections');
		});
	});

	// ============================================
	// collectionGroups computed
	// ============================================

	describe('collectionGroups', () => {
		it('should return groups via groupCollections utility', () => {
			fixture.componentRef.setInput('collections', [
				makeCollection('posts'),
				makeCollection('users'),
			]);
			fixture.detectChanges();

			const groups = component.collectionGroups();
			expect(groups.length).toBeGreaterThanOrEqual(1);
			// The default group name from groupCollections is "Collections"
			const defaultGroup = groups.find((g) => g.name === 'Collections');
			expect(defaultGroup).toBeDefined();
			expect(defaultGroup?.collections).toHaveLength(2);
		});

		it('should return empty when no collections provided', () => {
			fixture.componentRef.setInput('collections', []);
			fixture.detectChanges();
			expect(component.collectionGroups()).toEqual([]);
		});

		it('should separate collections into custom groups', () => {
			fixture.componentRef.setInput('collections', [
				makeCollection('posts', { admin: { group: 'Content' } }),
				makeCollection('users', { admin: { group: 'System' } }),
				makeCollection('pages'),
			]);
			fixture.detectChanges();

			const groups = component.collectionGroups();
			const names = groups.map((g) => g.name);
			expect(names).toContain('Content');
			expect(names).toContain('System');
			expect(names).toContain('Collections');
		});
	});

	// ============================================
	// globalGroups computed
	// ============================================

	describe('globalGroups', () => {
		it('should return empty array when globals is empty', () => {
			fixture.componentRef.setInput('globals', []);
			fixture.detectChanges();
			expect(component.globalGroups()).toEqual([]);
		});

		it('should group a single global under "Globals" by default', () => {
			fixture.componentRef.setInput('globals', [makeGlobal('site-settings')]);
			fixture.detectChanges();

			const groups = component.globalGroups();
			expect(groups).toHaveLength(1);
			expect(groups[0].name).toBe('Globals');
			expect(groups[0].globals).toHaveLength(1);
			expect(groups[0].globals[0].slug).toBe('site-settings');
		});

		it('should group globals with different admin.group values into separate groups', () => {
			fixture.componentRef.setInput('globals', [
				makeGlobal('site-settings', { admin: { group: 'Site' } }),
				makeGlobal('footer', { admin: { group: 'Layout' } }),
			]);
			fixture.detectChanges();

			const groups = component.globalGroups();
			expect(groups).toHaveLength(2);
			const names = groups.map((g) => g.name);
			expect(names).toContain('Site');
			expect(names).toContain('Layout');
		});

		it('should group multiple globals with the same custom group together', () => {
			fixture.componentRef.setInput('globals', [
				makeGlobal('header', { admin: { group: 'Layout' } }),
				makeGlobal('footer', { admin: { group: 'Layout' } }),
				makeGlobal('sidebar', { admin: { group: 'Layout' } }),
			]);
			fixture.detectChanges();

			const groups = component.globalGroups();
			expect(groups).toHaveLength(1);
			expect(groups[0].name).toBe('Layout');
			expect(groups[0].globals).toHaveLength(3);
		});

		it('should mix default and custom groups', () => {
			fixture.componentRef.setInput('globals', [
				makeGlobal('site-settings'),
				makeGlobal('header', { admin: { group: 'Layout' } }),
				makeGlobal('navigation'),
			]);
			fixture.detectChanges();

			const groups = component.globalGroups();
			expect(groups).toHaveLength(2);

			const defaultGroup = groups.find((g) => g.name === 'Globals');
			const layoutGroup = groups.find((g) => g.name === 'Layout');

			expect(defaultGroup).toBeDefined();
			expect(defaultGroup?.globals).toHaveLength(2);
			expect(layoutGroup).toBeDefined();
			expect(layoutGroup?.globals).toHaveLength(1);
		});
	});

	// ============================================
	// pluginRouteGroups computed
	// ============================================

	describe('pluginRouteGroups', () => {
		it('should return empty array when pluginRoutes is empty', () => {
			fixture.componentRef.setInput('pluginRoutes', []);
			fixture.detectChanges();
			expect(component.pluginRouteGroups()).toEqual([]);
		});

		it('should group a single route under "Plugins" by default', () => {
			fixture.componentRef.setInput('pluginRoutes', [
				makePluginRoute('analytics', { label: 'Analytics', icon: 'heroChartBarSquare' }),
			]);
			fixture.detectChanges();

			const groups = component.pluginRouteGroups();
			expect(groups).toHaveLength(1);
			expect(groups[0].name).toBe('Plugins');
			expect(groups[0].routes).toHaveLength(1);
			expect(groups[0].routes[0].path).toBe('analytics');
		});

		it('should group routes with custom group values', () => {
			fixture.componentRef.setInput('pluginRoutes', [
				makePluginRoute('analytics', { label: 'Analytics', group: 'Monitoring' }),
				makePluginRoute('logs', { label: 'Logs', group: 'Monitoring' }),
			]);
			fixture.detectChanges();

			const groups = component.pluginRouteGroups();
			expect(groups).toHaveLength(1);
			expect(groups[0].name).toBe('Monitoring');
			expect(groups[0].routes).toHaveLength(2);
		});

		it('should separate routes with different groups', () => {
			fixture.componentRef.setInput('pluginRoutes', [
				makePluginRoute('analytics', { label: 'Analytics', group: 'Monitoring' }),
				makePluginRoute('seo', { label: 'SEO', group: 'Marketing' }),
				makePluginRoute('health', { label: 'Health' }), // defaults to "Plugins"
			]);
			fixture.detectChanges();

			const groups = component.pluginRouteGroups();
			expect(groups).toHaveLength(3);
			const names = groups.map((g) => g.name);
			expect(names).toContain('Monitoring');
			expect(names).toContain('Marketing');
			expect(names).toContain('Plugins');
		});
	});

	// ============================================
	// getCollectionLabel
	// ============================================

	describe('getCollectionLabel', () => {
		it('should return humanized plural label when labels.plural is set', () => {
			const collection = makeCollection('blog-posts', {
				labels: { plural: 'blog-posts' },
			});
			// humanizeFieldName('blog-posts') => "Blog Posts"
			expect(component.getCollectionLabel(collection)).toBe('Blog Posts');
		});

		it('should fall back to humanized slug when labels.plural is not set', () => {
			const collection = makeCollection('site-pages');
			// humanizeFieldName('site-pages') => "Site Pages"
			expect(component.getCollectionLabel(collection)).toBe('Site Pages');
		});

		it('should use labels.plural over slug', () => {
			const collection = makeCollection('x', {
				labels: { plural: 'Custom Articles' },
			});
			expect(component.getCollectionLabel(collection)).toBe('Custom Articles');
		});
	});

	// ============================================
	// getCollectionPath
	// ============================================

	describe('getCollectionPath', () => {
		it('should construct path from default basePath', () => {
			const collection = makeCollection('posts');
			expect(component.getCollectionPath(collection)).toBe('/admin/collections/posts');
		});

		it('should reflect custom basePath', () => {
			fixture.componentRef.setInput('basePath', '/dashboard');
			fixture.detectChanges();

			const collection = makeCollection('users');
			expect(component.getCollectionPath(collection)).toBe('/dashboard/collections/users');
		});
	});

	// ============================================
	// getCollectionIcon
	// ============================================

	describe('getCollectionIcon', () => {
		it('should return heroNewspaper for posts', () => {
			const collection = makeCollection('posts');
			expect(component.getCollectionIcon(collection)).toBe('heroNewspaper');
		});

		it('should return heroUsers for users', () => {
			const collection = makeCollection('users');
			expect(component.getCollectionIcon(collection)).toBe('heroUsers');
		});

		it('should return heroPhoto for media', () => {
			const collection = makeCollection('media');
			expect(component.getCollectionIcon(collection)).toBe('heroPhoto');
		});

		it('should return heroDocument for pages', () => {
			const collection = makeCollection('pages');
			expect(component.getCollectionIcon(collection)).toBe('heroDocument');
		});

		it('should return heroFolder for unknown slugs', () => {
			const collection = makeCollection('custom-things');
			expect(component.getCollectionIcon(collection)).toBe('heroFolder');
		});
	});

	// ============================================
	// getGlobalLabel
	// ============================================

	describe('getGlobalLabel', () => {
		it('should return custom label when set', () => {
			const global = makeGlobal('site-settings', { label: 'Site Config' });
			expect(component.getGlobalLabel(global)).toBe('Site Config');
		});

		it('should fall back to humanized slug when label is not set', () => {
			const global = makeGlobal('site-settings');
			// humanizeFieldName('site-settings') => "Site Settings"
			expect(component.getGlobalLabel(global)).toBe('Site Settings');
		});

		it('should handle camelCase slugs', () => {
			const global = makeGlobal('footerConfig');
			// humanizeFieldName('footerConfig') => "Footer Config"
			expect(component.getGlobalLabel(global)).toBe('Footer Config');
		});
	});

	// ============================================
	// getUserInitials
	// ============================================

	describe('getUserInitials', () => {
		it('should return two-letter initials from a full name', () => {
			expect(component.getUserInitials('John Doe')).toBe('JD');
		});

		it('should return single initial from a single word name', () => {
			expect(component.getUserInitials('Admin')).toBe('A');
		});

		it('should return "?" for an empty string', () => {
			expect(component.getUserInitials('')).toBe('?');
		});

		it('should truncate to two characters for names with more than two parts', () => {
			expect(component.getUserInitials('Mary Jane Watson')).toBe('MJ');
		});

		it('should uppercase the initials', () => {
			expect(component.getUserInitials('jane doe')).toBe('JD');
		});
	});

	// ============================================
	// toggleTheme
	// ============================================

	describe('toggleTheme', () => {
		it('should call theme service toggleTheme', () => {
			component.toggleTheme();
			expect(mockThemeService.toggleTheme).toHaveBeenCalledTimes(1);
		});
	});

	// ============================================
	// onSignOutClick
	// ============================================

	describe('onSignOutClick', () => {
		it('should emit signOut event', () => {
			const emitSpy = vi.spyOn(component.signOut, 'emit');
			component.onSignOutClick();
			expect(emitSpy).toHaveBeenCalledTimes(1);
		});
	});

	// ============================================
	// Input defaults
	// ============================================

	describe('input defaults', () => {
		it('should default basePath to /admin', () => {
			expect(component.basePath()).toBe('/admin');
		});

		it('should default collections to empty array', () => {
			expect(component.collections()).toEqual([]);
		});

		it('should default globals to empty array', () => {
			expect(component.globals()).toEqual([]);
		});

		it('should default pluginRoutes to empty array', () => {
			expect(component.pluginRoutes()).toEqual([]);
		});

		it('should default user to null', () => {
			expect(component.user()).toBeNull();
		});

		it('should default collapsed to false', () => {
			expect(component.collapsed()).toBe(false);
		});

		it('should default width to 16rem', () => {
			expect(component.width()).toBe('16rem');
		});

		it('should default branding to undefined', () => {
			expect(component.branding()).toBeUndefined();
		});
	});

	// ============================================
	// Input setting
	// ============================================

	describe('setting inputs', () => {
		it('should accept a user input', () => {
			const user: AdminUser = { id: '1', name: 'Test User', email: 'test@example.com' };
			fixture.componentRef.setInput('user', user);
			fixture.detectChanges();
			expect(component.user()).toEqual(user);
		});

		it('should accept branding input', () => {
			fixture.componentRef.setInput('branding', { title: 'My CMS', logo: '/logo.svg' });
			fixture.detectChanges();
			expect(component.branding()).toEqual({ title: 'My CMS', logo: '/logo.svg' });
		});

		it('should accept collapsed input', () => {
			fixture.componentRef.setInput('collapsed', true);
			fixture.detectChanges();
			expect(component.collapsed()).toBe(true);
		});

		it('should accept width input', () => {
			fixture.componentRef.setInput('width', '20rem');
			fixture.detectChanges();
			expect(component.width()).toBe('20rem');
		});
	});
});
