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
	it('should open on hover after the configured delay', async () => {
		const fixture = TestBed.createComponent(HoverCardHost);
		const overlayContainer = TestBed.inject(OverlayContainer);
		fixture.detectChanges();

		const trigger = fixture.nativeElement.querySelector('button');
		trigger.dispatchEvent(new Event('mouseenter'));
		await new Promise((resolve) => setTimeout(resolve, 170));

		expect(
			overlayContainer.getContainerElement().querySelector('.hdl-hover-card-panel'),
		).toBeTruthy();
		expect(overlayContainer.getContainerElement().textContent).toContain('Author details');
	});
});
