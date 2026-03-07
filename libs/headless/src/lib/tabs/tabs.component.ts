import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Tabs } from '@angular/aria/tabs';

@Component({
	selector: 'hdl-tabs',
	hostDirectives: [Tabs],
	template: `<ng-content />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HdlTabs {}
