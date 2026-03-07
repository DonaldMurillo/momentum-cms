import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
	selector: 'hdl-accordion-item',
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlAccordionItem {}
