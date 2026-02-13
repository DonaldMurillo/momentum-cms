import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, input, signal } from '@angular/core';
import { BlockOutletComponent } from './block-outlet.component';
import { BLOCK_COMPONENT_REGISTRY, BLOCK_FALLBACK_COMPONENT } from './block-renderer.types';

@Component({ selector: 'mcms-test-hero', template: '<h1>{{ data()["heading"] }}</h1>' })
class MockHeroComponent {
	readonly data = input.required<Record<string, unknown>>();
}

@Component({ selector: 'mcms-test-text', template: '<p>{{ data()["body"] }}</p>' })
class MockTextComponent {
	readonly data = input.required<Record<string, unknown>>();
}

@Component({
	selector: 'mcms-test-fallback',
	template: '<div class="fallback">Unknown block</div>',
})
class MockFallbackComponent {
	readonly data = input.required<Record<string, unknown>>();
}

/** Test host to avoid parentElement sibling leaking between tests */
@Component({
	selector: 'mcms-test-host',
	imports: [BlockOutletComponent],
	template: `
		<div class="host">
			<mcms-block-outlet [blockType]="blockType()" [blockData]="blockData()" />
		</div>
	`,
})
class TestHostComponent {
	readonly blockType = signal('hero');
	readonly blockData = signal<Record<string, unknown>>({});
}

describe('BlockOutletComponent', () => {
	let hostFixture: ComponentFixture<TestHostComponent>;
	let host: TestHostComponent;

	function setup(options?: { fallback?: boolean }): void {
		const providers: unknown[] = [
			{
				provide: BLOCK_COMPONENT_REGISTRY,
				useValue: new Map<string, unknown>([
					['hero', MockHeroComponent],
					['text', MockTextComponent],
				]),
			},
		];

		if (options?.fallback) {
			providers.push({
				provide: BLOCK_FALLBACK_COMPONENT,
				useValue: MockFallbackComponent,
			});
		}

		TestBed.configureTestingModule({
			imports: [TestHostComponent],
			providers,
		});

		hostFixture = TestBed.createComponent(TestHostComponent);
		host = hostFixture.componentInstance;
	}

	function getHostEl(): HTMLElement {
		return hostFixture.nativeElement.querySelector('.host') as HTMLElement;
	}

	it('should create', async () => {
		setup();
		host.blockType.set('hero');
		host.blockData.set({ heading: 'Test' });
		hostFixture.detectChanges();
		await hostFixture.whenStable();

		expect(getHostEl().querySelector('mcms-block-outlet')).toBeTruthy();
	});

	it('should create the correct component for a registered block type', async () => {
		setup();
		host.blockType.set('hero');
		host.blockData.set({ heading: 'Hello World' });
		hostFixture.detectChanges();
		await hostFixture.whenStable();

		expect(getHostEl().querySelector('mcms-test-hero')).toBeTruthy();
		expect(getHostEl().querySelector('h1')?.textContent).toContain('Hello World');
	});

	it('should render a different component for a different block type', async () => {
		setup();
		host.blockType.set('text');
		host.blockData.set({ body: 'Some body text' });
		hostFixture.detectChanges();
		await hostFixture.whenStable();

		expect(getHostEl().querySelector('mcms-test-text')).toBeTruthy();
		expect(getHostEl().querySelector('p')?.textContent).toContain('Some body text');
	});

	it('should render nothing for an unregistered block type without fallback', async () => {
		setup();
		host.blockType.set('nonExistent');
		host.blockData.set({});
		hostFixture.detectChanges();
		await hostFixture.whenStable();

		expect(getHostEl().querySelector('mcms-test-hero')).toBeNull();
		expect(getHostEl().querySelector('mcms-test-text')).toBeNull();
		expect(getHostEl().querySelector('mcms-test-fallback')).toBeNull();
	});

	it('should use fallback component for unregistered block type when fallback is provided', async () => {
		setup({ fallback: true });
		host.blockType.set('nonExistent');
		host.blockData.set({});
		hostFixture.detectChanges();
		await hostFixture.whenStable();

		expect(getHostEl().querySelector('mcms-test-fallback')).toBeTruthy();
		expect(getHostEl().textContent).toContain('Unknown block');
	});

	it('should clear previous component when blockType changes', async () => {
		setup();
		host.blockType.set('hero');
		host.blockData.set({ heading: 'First' });
		hostFixture.detectChanges();
		await hostFixture.whenStable();

		expect(getHostEl().querySelector('mcms-test-hero')).toBeTruthy();

		host.blockType.set('text');
		host.blockData.set({ body: 'Second' });
		hostFixture.detectChanges();
		await hostFixture.whenStable();

		expect(getHostEl().querySelector('mcms-test-hero')).toBeNull();
		expect(getHostEl().querySelector('mcms-test-text')).toBeTruthy();
	});

	it('should update data when blockData changes', async () => {
		setup();
		host.blockType.set('hero');
		host.blockData.set({ heading: 'Initial' });
		hostFixture.detectChanges();
		await hostFixture.whenStable();

		expect(getHostEl().querySelector('h1')?.textContent).toContain('Initial');

		host.blockData.set({ heading: 'Updated' });
		hostFixture.detectChanges();
		await hostFixture.whenStable();

		expect(getHostEl().querySelector('h1')?.textContent).toContain('Updated');
	});
});
