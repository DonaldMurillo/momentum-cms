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
