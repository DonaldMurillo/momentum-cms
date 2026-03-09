import { Component, TemplateRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { HdlHoverCardTrigger } from './hover-card-trigger.directive';
import { HdlHoverCardContent } from './hover-card-content.component';

@Component({
	imports: [HdlHoverCardTrigger, HdlHoverCardContent],
	template: `
		<button type="button" [hdlHoverCardTrigger]="card">Profile</button>

		<ng-template #card>
			<hdl-hover-card-content>
				<div tabindex="0">Author details</div>
			</hdl-hover-card-content>
		</ng-template>
	`,
})
class HoverCardHost {
	readonly card = viewChild.required<TemplateRef<unknown>>('card');
}

describe('HdlHoverCardTrigger', () => {
	afterEach(() => {
		vi.useRealTimers();
		document.querySelector('.cdk-overlay-container')?.replaceChildren();
	});

	it('should open on hover after the configured delay', () => {
		vi.useFakeTimers();
		const fixture = TestBed.createComponent(HoverCardHost);
		const overlayContainer = TestBed.inject(OverlayContainer);
		fixture.detectChanges();

		const trigger = fixture.nativeElement.querySelector('button');
		trigger.dispatchEvent(new Event('mouseenter'));
		vi.advanceTimersByTime(160);

		expect(
			overlayContainer.getContainerElement().querySelector('.hdl-hover-card-panel'),
		).toBeTruthy();
		expect(overlayContainer.getContainerElement().textContent).toContain('Author details');
	});

	it('should NOT focus content when opened via mouseenter (WCAG 3.2.1)', () => {
		vi.useFakeTimers();
		const fixture = TestBed.createComponent(HoverCardHost);
		const overlayContainer = TestBed.inject(OverlayContainer);
		fixture.detectChanges();

		const trigger = fixture.nativeElement.querySelector('button') as HTMLElement;
		trigger.focus();

		trigger.dispatchEvent(new Event('mouseenter'));
		vi.advanceTimersByTime(160);
		// Flush any pending rAF
		vi.advanceTimersToNextTimer();

		// Guard: hover card must have actually opened
		expect(
			overlayContainer.getContainerElement().querySelector('.hdl-hover-card-panel'),
		).toBeTruthy();

		const focusable = overlayContainer
			.getContainerElement()
			.querySelector<HTMLElement>('[tabindex]');
		expect(focusable).toBeTruthy();
		// Focus should remain on the trigger, NOT move into the hover card
		expect(document.activeElement).toBe(trigger);
	});

	it('should focus content when opened via keyboard (focusin)', () => {
		vi.useFakeTimers();
		const fixture = TestBed.createComponent(HoverCardHost);
		const overlayContainer = TestBed.inject(OverlayContainer);
		fixture.detectChanges();

		const trigger = fixture.nativeElement.querySelector('button') as HTMLElement;
		trigger.dispatchEvent(new FocusEvent('focusin'));
		vi.advanceTimersByTime(160);
		// Flush rAF
		vi.advanceTimersToNextTimer();

		// Guard: hover card must have actually opened
		expect(
			overlayContainer.getContainerElement().querySelector('.hdl-hover-card-panel'),
		).toBeTruthy();

		const focusable = overlayContainer
			.getContainerElement()
			.querySelector<HTMLElement>('[tabindex]');
		expect(focusable).toBeTruthy();
		expect(document.activeElement).toBe(focusable);
	});

	it('should clear pending open timer when mouse leaves before delay elapses', () => {
		vi.useFakeTimers();
		const fixture = TestBed.createComponent(HoverCardHost);
		const overlayContainer = TestBed.inject(OverlayContainer);
		fixture.detectChanges();

		const trigger = fixture.nativeElement.querySelector('button');
		trigger.dispatchEvent(new Event('mouseenter'));
		vi.advanceTimersByTime(50);
		trigger.dispatchEvent(new Event('mouseleave'));
		vi.advanceTimersByTime(300);

		expect(
			overlayContainer.getContainerElement().querySelector('.hdl-hover-card-panel'),
		).toBeFalsy();
	});
});
