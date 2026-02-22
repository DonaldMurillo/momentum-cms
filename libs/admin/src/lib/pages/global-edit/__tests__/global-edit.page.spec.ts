import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { Component, signal } from '@angular/core';
import { GlobalEditPage } from '../global-edit.page';

@Component({ selector: 'mcms-entity-form', template: '' })
class MockEntityForm {
	isDirty = signal(false);
}

const mockGlobals = [
	{
		slug: 'site-settings',
		label: 'Site Settings',
		fields: [
			{ name: 'siteName', type: 'text' },
			{ name: 'tagline', type: 'text' },
		],
		admin: { description: 'General settings' },
		access: {
			read: (): boolean => true,
			update: (): boolean => true,
		},
		hooks: {},
		versions: { enabled: true },
	},
	{
		slug: 'footer',
		fields: [{ name: 'copyright', type: 'text' }],
	},
];

describe('GlobalEditPage', () => {
	let fixture: ComponentFixture<GlobalEditPage>;
	let component: GlobalEditPage;

	function createWithSlug(slug: string): void {
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({
			imports: [GlobalEditPage],
			providers: [
				provideRouter([]),
				{
					provide: ActivatedRoute,
					useValue: {
						snapshot: {
							paramMap: convertToParamMap({ slug }),
						},
						parent: {
							snapshot: {
								data: { globals: mockGlobals },
							},
						},
					},
				},
			],
		}).overrideComponent(GlobalEditPage, {
			set: {
				imports: [MockEntityForm],
				template: '<div></div>',
			},
		});

		fixture = TestBed.createComponent(GlobalEditPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}

	beforeEach(() => {
		createWithSlug('site-settings');
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should resolve globalSlug from route params', () => {
		expect(component.globalSlug()).toBe('site-settings');
	});

	it('should resolve globalConfig from route data', () => {
		const config = component.globalConfig();
		expect(config).toBeDefined();
		expect(config?.slug).toBe('site-settings');
		expect(config?.label).toBe('Site Settings');
	});

	it('should convert globalConfig to collectionConfig shape', () => {
		const colConfig = component.collectionConfig();
		expect(colConfig).toBeDefined();
		expect(colConfig?.slug).toBe('site-settings');
		expect(colConfig?.fields).toHaveLength(2);
		expect(colConfig?.labels?.singular).toBe('Site Settings');
		expect(colConfig?.labels?.plural).toBe('Site Settings');
		expect(colConfig?.admin).toEqual({ description: 'General settings' });
		expect(colConfig?.access).toBeDefined();
		expect(colConfig?.hooks).toBeDefined();
		expect(colConfig?.versions).toEqual({ enabled: true });
	});

	it('should use humanized slug as label when no label is provided', () => {
		createWithSlug('footer');
		const colConfig = component.collectionConfig();
		expect(colConfig?.labels?.singular).toBe('Footer');
	});

	it('should return undefined collectionConfig when global not found', () => {
		createWithSlug('nonexistent');
		expect(component.globalConfig()).toBeUndefined();
		expect(component.collectionConfig()).toBeUndefined();
	});

	it('should return undefined collectionConfig when slug is empty', () => {
		createWithSlug('');
		// Empty slug means no globals found
		expect(component.globalConfig()).toBeUndefined();
		expect(component.collectionConfig()).toBeUndefined();
	});

	it('should handle global without access config', () => {
		createWithSlug('footer');
		const colConfig = component.collectionConfig();
		expect(colConfig?.access).toBeUndefined();
	});

	describe('hasUnsavedChanges', () => {
		it('should return false when entityFormRef is not available', () => {
			// Template is overridden so no entityForm viewChild
			expect(component.hasUnsavedChanges()).toBe(false);
		});
	});
});
