import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OverlayModule } from '@angular/cdk/overlay';
import { PopoverContent } from './popover-content.component';
import { PopoverTrigger } from './popover-trigger.directive';

@Component({
	selector: 'mcms-test-host',
	imports: [PopoverTrigger, PopoverContent],
	template: `
		<button
			[mcmsPopoverTrigger]="popoverContent"
			[popoverSide]="side"
			[popoverAlign]="align"
			[popoverDisabled]="disabled"
		>
			Open Popover
		</button>

		<ng-template #popoverContent>
			<mcms-popover-content>
				<p>Test popover content</p>
				<button class="focusable-btn">Focusable button</button>
			</mcms-popover-content>
		</ng-template>
	`,
})
class TestHostComponent {
	side: 'top' | 'right' | 'bottom' | 'left' = 'bottom';
	align: 'start' | 'center' | 'end' = 'center';
	disabled = false;
}

describe('PopoverTrigger', () => {
	let fixture: ComponentFixture<TestHostComponent>;
	let component: TestHostComponent;
	let buttonElement: HTMLButtonElement;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TestHostComponent, OverlayModule],
		}).compileComponents();

		fixture = TestBed.createComponent(TestHostComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();

		buttonElement = fixture.nativeElement.querySelector('button');
	});

	afterEach(() => {
		const overlayContainer = document.querySelector('.cdk-overlay-container');
		if (overlayContainer) {
			while (overlayContainer.firstChild) {
				overlayContainer.removeChild(overlayContainer.firstChild);
			}
		}
	});

	it('should create', () => {
		expect(component).toBeTruthy();
		expect(buttonElement).toBeTruthy();
	});

	it('should have aria-expanded="false" initially', () => {
		expect(buttonElement.getAttribute('aria-expanded')).toBe('false');
	});

	it('should have aria-haspopup="dialog"', () => {
		expect(buttonElement.getAttribute('aria-haspopup')).toBe('dialog');
	});

	it('should set aria-expanded="true" when opened', () => {
		buttonElement.click();
		fixture.detectChanges();

		expect(buttonElement.getAttribute('aria-expanded')).toBe('true');
	});

	it('should set aria-expanded="false" when closed', () => {
		buttonElement.click();
		fixture.detectChanges();
		expect(buttonElement.getAttribute('aria-expanded')).toBe('true');

		// Close via backdrop click
		const backdrop = document.querySelector('.cdk-overlay-backdrop') as HTMLElement;
		expect(backdrop).toBeTruthy();
		backdrop.click();
		fixture.detectChanges();

		expect(buttonElement.getAttribute('aria-expanded')).toBe('false');
	});
});

describe('PopoverContent', () => {
	let fixture: ComponentFixture<PopoverContent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [PopoverContent],
		}).compileComponents();

		fixture = TestBed.createComponent(PopoverContent);
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have role="dialog"', () => {
		expect(fixture.nativeElement.getAttribute('role')).toBe('dialog');
	});
});
