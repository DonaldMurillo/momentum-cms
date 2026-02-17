import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { tabs, text } from '@momentumcms/core';
import type { Field, TabConfig } from '@momentumcms/core';
import { TabsFieldRenderer } from '../tabs-field.component';

/**
 * Minimal mock of a FieldTree node.
 * In the real system, FieldTree nodes are callable functions that return FieldState.
 * For these tests, we just need objects with named sub-nodes.
 */
function createMockFormTree(shape: Record<string, unknown>): unknown {
	return shape;
}

describe('TabsFieldRenderer', () => {
	let fixture: ComponentFixture<TabsFieldRenderer>;
	let component: TabsFieldRenderer;

	/**
	 * Helper to create the component with optional query params.
	 * Must be called inside each test or beforeEach after configuring providers.
	 */
	async function setup(queryParams: Record<string, string> = {}): Promise<void> {
		await TestBed.configureTestingModule({
			imports: [TabsFieldRenderer],
			providers: [
				provideRouter([]),
				{
					provide: ActivatedRoute,
					useValue: { snapshot: { queryParams } },
				},
			],
		}).compileComponents();

		fixture = TestBed.createComponent(TabsFieldRenderer);
		component = fixture.componentInstance;
	}

	describe('getChildFormNode()', () => {
		beforeEach(async () => {
			await setup();
		});

		it('should look up from root formTree for unnamed tabs', () => {
			const tabsField = tabs('content', {
				tabs: [{ label: 'General', fields: [text('title')] }],
			});

			const mockTree = createMockFormTree({
				title: 'title-node',
			});

			fixture.componentRef.setInput('field', tabsField as Field);
			fixture.componentRef.setInput('formTree', mockTree);
			fixture.componentRef.setInput('path', 'content');
			fixture.detectChanges();

			const unnamedTab: TabConfig = { label: 'General', fields: [text('title')] };
			const node = component.getChildFormNode(unnamedTab, 'title');
			expect(node).toBe('title-node');
		});

		it('should look up from nested node for named tabs', () => {
			const tabsField = tabs('content', {
				tabs: [{ name: 'seo', label: 'SEO', fields: [text('metaTitle')] }],
			});

			const mockTree = createMockFormTree({
				seo: { metaTitle: 'nested-meta-node' },
			});

			fixture.componentRef.setInput('field', tabsField as Field);
			fixture.componentRef.setInput('formTree', mockTree);
			fixture.componentRef.setInput('path', 'content');
			fixture.detectChanges();

			const namedTab: TabConfig = { name: 'seo', label: 'SEO', fields: [text('metaTitle')] };
			const node = component.getChildFormNode(namedTab, 'metaTitle');
			expect(node).toBe('nested-meta-node');
		});

		it('should handle mixed named and unnamed tabs independently', () => {
			const tabsField = tabs('settings', {
				tabs: [
					{ label: 'General', fields: [text('title')] },
					{ name: 'seo', label: 'SEO', fields: [text('metaTitle')] },
				],
			});

			const mockTree = createMockFormTree({
				title: 'flat-title-node',
				seo: { metaTitle: 'nested-meta-node' },
			});

			fixture.componentRef.setInput('field', tabsField as Field);
			fixture.componentRef.setInput('formTree', mockTree);
			fixture.componentRef.setInput('path', 'settings');
			fixture.detectChanges();

			const unnamedTab: TabConfig = { label: 'General', fields: [text('title')] };
			const namedTab: TabConfig = { name: 'seo', label: 'SEO', fields: [text('metaTitle')] };

			expect(component.getChildFormNode(unnamedTab, 'title')).toBe('flat-title-node');
			expect(component.getChildFormNode(namedTab, 'metaTitle')).toBe('nested-meta-node');
		});

		it('should return null when named tab node does not exist in tree', () => {
			const tabsField = tabs('content', {
				tabs: [{ name: 'seo', label: 'SEO', fields: [text('metaTitle')] }],
			});

			const mockTree = createMockFormTree({});

			fixture.componentRef.setInput('field', tabsField as Field);
			fixture.componentRef.setInput('formTree', mockTree);
			fixture.componentRef.setInput('path', 'content');
			fixture.detectChanges();

			const namedTab: TabConfig = { name: 'seo', label: 'SEO', fields: [text('metaTitle')] };
			expect(component.getChildFormNode(namedTab, 'metaTitle')).toBeNull();
		});
	});

	describe('getFieldPath()', () => {
		beforeEach(async () => {
			await setup();
		});

		it('should return flat field name for unnamed tabs', () => {
			const tabsField = tabs('content', {
				tabs: [{ label: 'General', fields: [text('title')] }],
			});

			fixture.componentRef.setInput('field', tabsField as Field);
			fixture.componentRef.setInput('formTree', null);
			fixture.componentRef.setInput('path', 'content');
			fixture.detectChanges();

			const unnamedTab: TabConfig = { label: 'General', fields: [text('title')] };
			expect(component.getFieldPath(unnamedTab, 'title')).toBe('title');
		});

		it('should return nested path for named tabs', () => {
			const tabsField = tabs('content', {
				tabs: [{ name: 'seo', label: 'SEO', fields: [text('metaTitle')] }],
			});

			fixture.componentRef.setInput('field', tabsField as Field);
			fixture.componentRef.setInput('formTree', null);
			fixture.componentRef.setInput('path', 'content');
			fixture.detectChanges();

			const namedTab: TabConfig = { name: 'seo', label: 'SEO', fields: [text('metaTitle')] };
			expect(component.getFieldPath(namedTab, 'metaTitle')).toBe('seo.metaTitle');
		});
	});

	describe('tabConfigs()', () => {
		beforeEach(async () => {
			await setup();
		});

		it('should extract tab configs from a tabs field', () => {
			const tabsField = tabs('content', {
				tabs: [
					{ label: 'General', fields: [text('title')] },
					{ name: 'seo', label: 'SEO', fields: [text('metaTitle')] },
				],
			});

			fixture.componentRef.setInput('field', tabsField as Field);
			fixture.componentRef.setInput('formTree', null);
			fixture.componentRef.setInput('path', 'content');
			fixture.detectChanges();

			const configs = component.tabConfigs();
			expect(configs).toHaveLength(2);
			expect(configs[0].label).toBe('General');
			expect(configs[0].name).toBeUndefined();
			expect(configs[1].label).toBe('SEO');
			expect(configs[1].name).toBe('seo');
		});
	});

	describe('default tab selection', () => {
		beforeEach(async () => {
			await setup();
		});

		it('should default selectedTab to the first tab label', () => {
			const tabsField = tabs('content', {
				tabs: [
					{ label: 'General', fields: [text('title')] },
					{ name: 'seo', label: 'SEO', fields: [text('metaTitle')] },
				],
			});

			fixture.componentRef.setInput('field', tabsField as Field);
			fixture.componentRef.setInput('formTree', null);
			fixture.componentRef.setInput('path', 'content');
			fixture.detectChanges();

			expect(component.selectedTab()).toBe('General');
		});

		it('should default to first tab even when it is a named tab', () => {
			const tabsField = tabs('content', {
				tabs: [
					{ name: 'seo', label: 'SEO', fields: [text('metaTitle')] },
					{ label: 'Other', fields: [text('other')] },
				],
			});

			fixture.componentRef.setInput('field', tabsField as Field);
			fixture.componentRef.setInput('formTree', null);
			fixture.componentRef.setInput('path', 'content');
			fixture.detectChanges();

			expect(component.selectedTab()).toBe('SEO');
		});

		it('should remain empty when there are no tabs', () => {
			const tabsField = tabs('empty', { tabs: [] });

			fixture.componentRef.setInput('field', tabsField as Field);
			fixture.componentRef.setInput('formTree', null);
			fixture.componentRef.setInput('path', 'empty');
			fixture.detectChanges();

			expect(component.selectedTab()).toBe('');
		});
	});

	describe('query param tab persistence', () => {
		it('should restore selected tab from query param on init', async () => {
			await setup({ settingsTabs: 'Social' });

			const tabsField = tabs('settingsTabs', {
				tabs: [
					{ label: 'General', fields: [text('title')] },
					{ label: 'Social', fields: [text('twitterHandle')] },
				],
			});

			fixture.componentRef.setInput('field', tabsField as Field);
			fixture.componentRef.setInput('formTree', null);
			fixture.componentRef.setInput('path', 'settingsTabs');
			fixture.detectChanges();

			expect(component.selectedTab()).toBe('Social');
		});

		it('should fall back to first tab when query param has invalid tab name', async () => {
			await setup({ settingsTabs: 'Nonexistent' });

			const tabsField = tabs('settingsTabs', {
				tabs: [
					{ label: 'General', fields: [text('title')] },
					{ label: 'Social', fields: [text('twitterHandle')] },
				],
			});

			fixture.componentRef.setInput('field', tabsField as Field);
			fixture.componentRef.setInput('formTree', null);
			fixture.componentRef.setInput('path', 'settingsTabs');
			fixture.detectChanges();

			expect(component.selectedTab()).toBe('General');
		});

		it('should update query param when tab changes', async () => {
			await setup();

			const router = TestBed.inject(Router);
			const navigateSpy = vi.spyOn(router, 'navigate');

			const tabsField = tabs('settingsTabs', {
				tabs: [
					{ label: 'General', fields: [text('title')] },
					{ label: 'Social', fields: [text('twitterHandle')] },
				],
			});

			fixture.componentRef.setInput('field', tabsField as Field);
			fixture.componentRef.setInput('formTree', null);
			fixture.componentRef.setInput('path', 'settingsTabs');
			fixture.detectChanges();

			// Simulate user clicking on "Social" tab
			component.selectedTab.set('Social');
			fixture.detectChanges();

			expect(navigateSpy).toHaveBeenCalledWith([], {
				queryParams: { settingsTabs: 'Social' },
				queryParamsHandling: 'merge',
				replaceUrl: true,
			});
		});

		it('should not update query param when defaulting to first tab', async () => {
			await setup();

			const router = TestBed.inject(Router);
			const navigateSpy = vi.spyOn(router, 'navigate');

			const tabsField = tabs('settingsTabs', {
				tabs: [
					{ label: 'General', fields: [text('title')] },
					{ label: 'Social', fields: [text('twitterHandle')] },
				],
			});

			fixture.componentRef.setInput('field', tabsField as Field);
			fixture.componentRef.setInput('formTree', null);
			fixture.componentRef.setInput('path', 'settingsTabs');
			fixture.detectChanges();

			// Default tab selection should NOT trigger a URL update
			expect(navigateSpy).not.toHaveBeenCalled();
		});
	});
});
