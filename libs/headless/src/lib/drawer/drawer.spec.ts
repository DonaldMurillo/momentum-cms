import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { HdlDrawer } from './drawer.component';
import { HdlDrawerTitle } from './drawer-title.component';
import { HdlDrawerDescription } from './drawer-description.component';
import { HdlDrawerService } from './drawer.service';

@Component({
	imports: [HdlDrawer, HdlDrawerTitle, HdlDrawerDescription],
	template: `
		<hdl-drawer side="left">
			<hdl-drawer-title>Filters</hdl-drawer-title>
			<hdl-drawer-description>Adjust visible records.</hdl-drawer-description>
		</hdl-drawer>
	`,
})
class DrawerHost {}

@Component({
	imports: [HdlDrawer],
	template: `<hdl-drawer>Overlay Drawer</hdl-drawer>`,
})
class DrawerOverlayHost {}

describe('HdlDrawer', () => {
	it('should expose drawer semantics', () => {
		const fixture = TestBed.createComponent(DrawerHost);
		fixture.detectChanges();

		const drawer = fixture.nativeElement.querySelector('hdl-drawer');
		expect(drawer.getAttribute('role')).toBe('dialog');
		expect(drawer.getAttribute('data-side')).toBe('left');
	});

	it('should expose stable overlay classes', () => {
		const drawerService = TestBed.inject(HdlDrawerService);
		const overlayContainer = TestBed.inject(OverlayContainer);

		drawerService.open(DrawerOverlayHost, { side: 'bottom' });

		expect(overlayContainer.getContainerElement().querySelector('.hdl-drawer-panel')).toBeTruthy();
		expect(
			overlayContainer.getContainerElement().querySelector('.hdl-drawer-panel--bottom'),
		).toBeTruthy();
		expect(
			overlayContainer.getContainerElement().querySelector('.hdl-drawer-backdrop'),
		).toBeTruthy();
	});
});
