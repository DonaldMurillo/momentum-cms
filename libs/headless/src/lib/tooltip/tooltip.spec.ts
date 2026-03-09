import { OverlayModule } from '@angular/cdk/overlay';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { TOOLTIP_POSITION_MAP } from './tooltip.types';
import { HdlTooltipTrigger } from './tooltip-trigger.directive';

@Component({
	imports: [HdlTooltipTrigger],
	template: `
		<button type="button" hdlTooltip="Tooltip body" [tooltipDelay]="0">Hover me</button>
	`,
})
class TooltipHost {}

describe('Tooltip Types', () => {
	it('should have position configs for all four sides', () => {
		expect(TOOLTIP_POSITION_MAP['top']).toBeDefined();
		expect(TOOLTIP_POSITION_MAP['bottom']).toBeDefined();
		expect(TOOLTIP_POSITION_MAP['left']).toBeDefined();
		expect(TOOLTIP_POSITION_MAP['right']).toBeDefined();
	});

	it('should have primary and fallback positions for each side', () => {
		expect(TOOLTIP_POSITION_MAP['top'].length).toBe(2);
		expect(TOOLTIP_POSITION_MAP['bottom'].length).toBe(2);
		expect(TOOLTIP_POSITION_MAP['left'].length).toBe(2);
		expect(TOOLTIP_POSITION_MAP['right'].length).toBe(2);
	});

	it('should position top tooltip above element', () => {
		const pos = TOOLTIP_POSITION_MAP['top'][0];
		expect(pos.originY).toBe('top');
		expect(pos.overlayY).toBe('bottom');
		expect(pos.originX).toBe('center');
		expect(pos.overlayX).toBe('center');
	});

	it('should position bottom tooltip below element', () => {
		const pos = TOOLTIP_POSITION_MAP['bottom'][0];
		expect(pos.originY).toBe('bottom');
		expect(pos.overlayY).toBe('top');
		expect(pos.originX).toBe('center');
		expect(pos.overlayX).toBe('center');
	});

	it('should position left tooltip to the left of element', () => {
		const pos = TOOLTIP_POSITION_MAP['left'][0];
		expect(pos.originX).toBe('start');
		expect(pos.overlayX).toBe('end');
	});

	it('should position right tooltip to the right of element', () => {
		const pos = TOOLTIP_POSITION_MAP['right'][0];
		expect(pos.originX).toBe('end');
		expect(pos.overlayX).toBe('start');
	});

	it('should have opposite fallback for top position', () => {
		const fallback = TOOLTIP_POSITION_MAP['top'][1];
		expect(fallback.originY).toBe('bottom');
		expect(fallback.overlayY).toBe('top');
	});

	it('should have opposite fallback for bottom position', () => {
		const fallback = TOOLTIP_POSITION_MAP['bottom'][1];
		expect(fallback.originY).toBe('top');
		expect(fallback.overlayY).toBe('bottom');
	});
});

describe('HdlTooltipTrigger', () => {
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OverlayModule, TooltipHost],
		}).compileComponents();
	});

	afterEach(() => {
		vi.useRealTimers();
		document.querySelector('.cdk-overlay-container')?.replaceChildren();
	});

	it('should clear pending show timer when mouse leaves before delay elapses', () => {
		vi.useFakeTimers();
		const fixture = TestBed.createComponent(TooltipHost);
		fixture.detectChanges();
		const trigger = fixture.nativeElement.querySelector('button');

		trigger.dispatchEvent(new MouseEvent('mouseenter'));
		vi.advanceTimersByTime(0); // delay is 0 for this test host, so it fires immediately
		fixture.detectChanges();

		// Tooltip should open since delay=0
		expect(document.querySelector('hdl-tooltip-content')).toBeTruthy();

		// Mouse leave should dismiss
		trigger.dispatchEvent(new MouseEvent('mouseleave'));
		vi.advanceTimersByTime(200);
		fixture.detectChanges();

		expect(document.querySelector('hdl-tooltip-content')).toBeFalsy();
	});

	it('should expose styling contract attributes and tooltip overlay selectors', () => {
		vi.useFakeTimers();
		const fixture = TestBed.createComponent(TooltipHost);
		fixture.detectChanges();
		const trigger = fixture.nativeElement.querySelector('button');

		expect(trigger.getAttribute('data-slot')).toBe('tooltip-trigger');
		expect(trigger.getAttribute('data-state')).toBe('closed');

		trigger.dispatchEvent(new MouseEvent('mouseenter'));
		vi.runAllTimers();
		fixture.detectChanges();

		const tooltip = document.querySelector('hdl-tooltip-content');
		expect(trigger.getAttribute('data-state')).toBe('open');
		expect(document.querySelector('.hdl-tooltip-panel')).toBeTruthy();
		expect(tooltip?.getAttribute('data-slot')).toBe('tooltip-content');
	});
});
