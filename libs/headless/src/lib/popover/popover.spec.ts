import { OverlayModule } from '@angular/cdk/overlay';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { getPopoverPositions } from './popover.utils';
import { HdlPopoverContent } from './popover-content.component';
import { HdlPopoverTrigger } from './popover-trigger.directive';

@Component({
	imports: [HdlPopoverTrigger, HdlPopoverContent],
	template: `
		<button type="button" [hdlPopoverTrigger]="panel">Open popover</button>
		<ng-template #panel>
			<hdl-popover-content>Popover body</hdl-popover-content>
		</ng-template>
	`,
})
class PopoverHost {}

describe('Popover Utils', () => {
	it('should return positions for bottom side', () => {
		const positions = getPopoverPositions('bottom', 'center', 4);
		expect(positions.length).toBe(2);
		expect(positions[0].originY).toBe('bottom');
		expect(positions[0].overlayY).toBe('top');
	});

	it('should return positions for top side', () => {
		const positions = getPopoverPositions('top', 'center', 4);
		expect(positions.length).toBe(2);
		expect(positions[0].originY).toBe('top');
		expect(positions[0].overlayY).toBe('bottom');
	});

	it('should return positions for left side', () => {
		const positions = getPopoverPositions('left', 'center', 4);
		expect(positions.length).toBe(2);
		expect(positions[0].originX).toBe('start');
		expect(positions[0].overlayX).toBe('end');
	});

	it('should return positions for right side', () => {
		const positions = getPopoverPositions('right', 'center', 4);
		expect(positions.length).toBe(2);
		expect(positions[0].originX).toBe('end');
		expect(positions[0].overlayX).toBe('start');
	});

	it('should apply offset to bottom position', () => {
		const positions = getPopoverPositions('bottom', 'center', 8);
		expect(positions[0].offsetY).toBe(8);
	});

	it('should respect start alignment', () => {
		const positions = getPopoverPositions('bottom', 'start', 4);
		expect(positions[0].originX).toBe('start');
		expect(positions[0].overlayX).toBe('start');
	});

	it('should respect end alignment', () => {
		const positions = getPopoverPositions('bottom', 'end', 4);
		expect(positions[0].originX).toBe('end');
		expect(positions[0].overlayX).toBe('end');
	});
});

describe('HdlPopoverTrigger', () => {
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OverlayModule, PopoverHost],
		}).compileComponents();
	});

	afterEach(() => {
		document.querySelector('.cdk-overlay-container')?.replaceChildren();
	});

	it('should expose styling contract attributes and overlay selectors', () => {
		const fixture = TestBed.createComponent(PopoverHost);
		fixture.detectChanges();
		const trigger = fixture.nativeElement.querySelector('button');

		expect(trigger.getAttribute('data-slot')).toBe('popover-trigger');
		expect(trigger.getAttribute('data-state')).toBe('closed');

		trigger.click();
		fixture.detectChanges();

		const content = document.querySelector('hdl-popover-content');
		expect(trigger.getAttribute('data-state')).toBe('open');
		expect(document.querySelector('.hdl-popover-panel')).toBeTruthy();
		expect(document.querySelector('.hdl-popover-backdrop')).toBeTruthy();
		expect(content?.getAttribute('data-slot')).toBe('popover-content');
	});
});
