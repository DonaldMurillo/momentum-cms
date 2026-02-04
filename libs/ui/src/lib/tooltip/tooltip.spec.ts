import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OverlayModule } from '@angular/cdk/overlay';
import { TooltipTrigger } from './tooltip-trigger.directive';
import { TooltipContent } from './tooltip-content.component';

@Component({
	selector: 'mcms-test-host',
	imports: [TooltipTrigger],
	template: `
		<button
			[mcmsTooltip]="tooltipText"
			[tooltipPosition]="position"
			[tooltipDelay]="delay"
			[tooltipDisabled]="disabled"
		>
			Hover me
		</button>
	`,
})
class TestHostComponent {
	tooltipText = 'Test tooltip';
	position: 'top' | 'right' | 'bottom' | 'left' = 'top';
	delay = 300;
	disabled = false;
}

describe('TooltipTrigger', () => {
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

	it('should not have aria-describedby initially', () => {
		expect(buttonElement.getAttribute('aria-describedby')).toBeNull();
	});
});

describe('TooltipContent', () => {
	let fixture: ComponentFixture<TooltipContent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TooltipContent],
		}).compileComponents();

		fixture = TestBed.createComponent(TooltipContent);
		fixture.componentRef.setInput('content', 'Test content');
		fixture.componentRef.setInput('id', 'tooltip-1');
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have role="tooltip"', () => {
		expect(fixture.nativeElement.getAttribute('role')).toBe('tooltip');
	});

	it('should display content', () => {
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toBe('Test content');
	});
});
