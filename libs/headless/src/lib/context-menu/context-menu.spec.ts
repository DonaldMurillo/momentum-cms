import { Component, TemplateRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { HdlContextMenuTrigger } from './context-menu-trigger.directive';
import { HdlContextMenuContent } from './context-menu-content.component';

@Component({
	imports: [HdlContextMenuTrigger, HdlContextMenuContent],
	template: `
		<div [hdlContextMenuTrigger]="menu">Canvas</div>

		<ng-template #menu>
			<hdl-context-menu-content>
				<button type="button">Duplicate</button>
			</hdl-context-menu-content>
		</ng-template>
	`,
})
class TestHost {
	readonly menu = viewChild.required<TemplateRef<unknown>>('menu');
}

describe('HdlContextMenuTrigger', () => {
	it('should open a context menu overlay at pointer coordinates', () => {
		const fixture = TestBed.createComponent(TestHost);
		const overlayContainer = TestBed.inject(OverlayContainer);
		fixture.detectChanges();

		const trigger = fixture.nativeElement.querySelector('div');
		trigger.dispatchEvent(
			new MouseEvent('contextmenu', { clientX: 20, clientY: 30, bubbles: true }),
		);
		fixture.detectChanges();

		expect(
			overlayContainer.getContainerElement().querySelector('.hdl-context-menu-panel'),
		).toBeTruthy();
		expect(overlayContainer.getContainerElement().textContent).toContain('Duplicate');
	});
});
