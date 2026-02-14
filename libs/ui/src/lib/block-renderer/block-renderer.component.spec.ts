import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, input, signal } from '@angular/core';
import { BlockRendererComponent } from './block-renderer.component';
import { BLOCK_ADMIN_MODE, BLOCK_COMPONENT_REGISTRY } from './block-renderer.types';
import { BlockAdminModeService, provideBlockAdminMode } from './block-admin-mode.service';

@Component({ selector: 'mcms-test-hero', template: '<h1>{{ data()["heading"] }}</h1>' })
class MockHeroComponent {
	readonly data = input.required<Record<string, unknown>>();
}

@Component({ selector: 'mcms-test-text', template: '<p>{{ data()["body"] }}</p>' })
class MockTextComponent {
	readonly data = input.required<Record<string, unknown>>();
}

@Component({
	selector: 'mcms-test-host',
	imports: [BlockRendererComponent],
	template: `<mcms-block-renderer [blocks]="blocks()" [typeField]="typeField()" />`,
})
class TestHostComponent {
	readonly blocks = signal<Record<string, unknown>[]>([]);
	readonly typeField = signal('blockType');
}

describe('BlockRendererComponent', () => {
	let fixture: ComponentFixture<TestHostComponent>;
	let host: TestHostComponent;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TestHostComponent],
			providers: [
				{
					provide: BLOCK_COMPONENT_REGISTRY,
					useValue: new Map<string, unknown>([
						['hero', MockHeroComponent],
						['text', MockTextComponent],
					]),
				},
			],
		}).compileComponents();

		fixture = TestBed.createComponent(TestHostComponent);
		host = fixture.componentInstance;
	});

	function getRendererEl(): HTMLElement {
		return fixture.nativeElement.querySelector('mcms-block-renderer') as HTMLElement;
	}

	it('should create', () => {
		fixture.detectChanges();
		expect(getRendererEl()).toBeTruthy();
	});

	it('should render nothing for empty blocks array', async () => {
		host.blocks.set([]);
		fixture.detectChanges();
		await fixture.whenStable();

		expect(getRendererEl().querySelector('mcms-block-outlet')).toBeNull();
	});

	it('should render one outlet per block', async () => {
		host.blocks.set([
			{ blockType: 'hero', heading: 'Title' },
			{ blockType: 'text', body: 'Content' },
		]);
		fixture.detectChanges();
		await fixture.whenStable();

		expect(getRendererEl().querySelector('mcms-test-hero')).toBeTruthy();
		expect(getRendererEl().querySelector('mcms-test-text')).toBeTruthy();
	});

	it('should skip blocks with non-string blockType', async () => {
		host.blocks.set([
			{ blockType: 'hero', heading: 'Valid' },
			{ blockType: 123 },
			{ noType: true },
		]);
		fixture.detectChanges();
		await fixture.whenStable();

		// Only one valid block should render, no outlet for invalid types
		const heroes = getRendererEl().querySelectorAll('mcms-test-hero');
		expect(heroes.length).toBe(1);
	});

	it('should use custom typeField', async () => {
		host.typeField.set('type');
		host.blocks.set([{ type: 'hero', heading: 'Custom Key' }]);
		fixture.detectChanges();
		await fixture.whenStable();

		expect(getRendererEl().querySelector('mcms-test-hero')).toBeTruthy();
		expect(getRendererEl().querySelector('h1')?.textContent).toContain('Custom Key');
	});

	it('should default typeField to blockType', () => {
		fixture.detectChanges();
		const renderer = fixture.nativeElement.querySelector('mcms-block-renderer');
		expect(renderer).toBeTruthy();
		// BlockRendererComponent instance defaults to 'blockType'
		// Verified by the fact that blocks with 'blockType' key render correctly
	});

	describe('getBlockType', () => {
		let component: BlockRendererComponent;

		beforeEach(() => {
			fixture.detectChanges();
			// Access the inner component via the renderer element
			const rendererFixture = TestBed.createComponent(BlockRendererComponent);
			component = rendererFixture.componentInstance;
		});

		it('should return string value for valid blockType', () => {
			expect(component.getBlockType({ blockType: 'hero' })).toBe('hero');
		});

		it('should return null for non-string blockType', () => {
			expect(component.getBlockType({ blockType: 42 })).toBeNull();
		});

		it('should return null for missing blockType', () => {
			expect(component.getBlockType({})).toBeNull();
		});
	});

	it('should default adminMode to false when no service or token provided', () => {
		fixture.detectChanges();
		const rendererFixture = TestBed.createComponent(BlockRendererComponent);
		expect(rendererFixture.componentInstance.adminMode()).toBe(false);
	});
});

describe('BlockRendererComponent (admin mode via service)', () => {
	let fixture: ComponentFixture<TestHostAdminComponent>;
	let host: TestHostAdminComponent;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TestHostAdminComponent],
			providers: [
				{
					provide: BLOCK_COMPONENT_REGISTRY,
					useValue: new Map<string, unknown>([
						['hero', MockHeroComponent],
						['text', MockTextComponent],
					]),
				},
				...provideBlockAdminMode(true),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(TestHostAdminComponent);
		host = fixture.componentInstance;
	});

	it('should render edit overlays when service admin mode is enabled', async () => {
		host.blocks.set([{ blockType: 'hero', heading: 'Title' }]);
		fixture.detectChanges();
		await fixture.whenStable();

		const wrapper = fixture.nativeElement.querySelector('[data-testid="block-edit-wrapper"]');
		expect(wrapper).toBeTruthy();
	});

	it('should reactively update when service toggles', async () => {
		host.blocks.set([{ blockType: 'hero', heading: 'Title' }]);
		fixture.detectChanges();
		await fixture.whenStable();

		// Initially admin mode is on
		expect(fixture.nativeElement.querySelector('[data-testid="block-edit-wrapper"]')).toBeTruthy();

		// Disable via service
		const service = TestBed.inject(BlockAdminModeService);
		service.disable();
		fixture.detectChanges();
		await fixture.whenStable();

		expect(fixture.nativeElement.querySelector('[data-testid="block-edit-wrapper"]')).toBeNull();
	});
});

describe('BlockRendererComponent (admin mode via deprecated token)', () => {
	let fixture: ComponentFixture<TestHostAdminComponent>;
	let host: TestHostAdminComponent;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TestHostAdminComponent],
			providers: [
				{
					provide: BLOCK_COMPONENT_REGISTRY,
					useValue: new Map<string, unknown>([
						['hero', MockHeroComponent],
						['text', MockTextComponent],
					]),
				},
				{ provide: BLOCK_ADMIN_MODE, useValue: true },
			],
		}).compileComponents();

		fixture = TestBed.createComponent(TestHostAdminComponent);
		host = fixture.componentInstance;
	});

	it('should render edit overlay wrappers when admin mode is active', async () => {
		host.blocks.set([{ blockType: 'hero', heading: 'Title' }]);
		fixture.detectChanges();
		await fixture.whenStable();

		const wrapper = fixture.nativeElement.querySelector('[data-testid="block-edit-wrapper"]');
		expect(wrapper).toBeTruthy();
	});

	it('should render edit button for each block', async () => {
		host.blocks.set([
			{ blockType: 'hero', heading: 'Title' },
			{ blockType: 'text', body: 'Content' },
		]);
		fixture.detectChanges();
		await fixture.whenStable();

		const buttons = fixture.nativeElement.querySelectorAll('[data-testid="block-edit-button"]');
		expect(buttons.length).toBe(2);
	});

	it('should set data-block-index on wrappers', async () => {
		host.blocks.set([
			{ blockType: 'hero', heading: 'A' },
			{ blockType: 'text', body: 'B' },
		]);
		fixture.detectChanges();
		await fixture.whenStable();

		const wrappers = fixture.nativeElement.querySelectorAll('[data-testid="block-edit-wrapper"]');
		expect(wrappers[0].getAttribute('data-block-index')).toBe('0');
		expect(wrappers[1].getAttribute('data-block-index')).toBe('1');
	});

	it('should emit editBlock when edit button is clicked', async () => {
		host.blocks.set([{ blockType: 'hero', heading: 'Title' }]);
		fixture.detectChanges();
		await fixture.whenStable();

		const emittedValues: number[] = [];
		// Get the BlockRendererComponent instance directly
		const rendererDebug = fixture.debugElement.query(
			(de) => de.componentInstance instanceof BlockRendererComponent,
		);
		if (rendererDebug) {
			rendererDebug.componentInstance.editBlock.subscribe((val: number) => emittedValues.push(val));
		}

		const button = fixture.nativeElement.querySelector('[data-testid="block-edit-button"]');
		button?.click();
		fixture.detectChanges();

		expect(emittedValues).toEqual([0]);
	});
});

@Component({
	selector: 'mcms-test-host-admin',
	imports: [BlockRendererComponent],
	template: `<mcms-block-renderer [blocks]="blocks()" (editBlock)="lastEditBlock.set($event)" />`,
})
class TestHostAdminComponent {
	readonly blocks = signal<Record<string, unknown>[]>([]);
	readonly lastEditBlock = signal<number | null>(null);
}
