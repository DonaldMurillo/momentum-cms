import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { HdlTabs } from './tabs.component';
import { HdlTabList } from './tab-list.component';
import { HdlTab } from './tab.component';
import { HdlTabPanel } from './tab-panel.component';

@Component({
	imports: [HdlTabs, HdlTabList, HdlTab, HdlTabPanel],
	template: `
		<hdl-tabs>
			<hdl-tab-list [selectedTab]="selectedTab">
				<hdl-tab value="tab1">Tab 1</hdl-tab>
				<hdl-tab value="tab2">Tab 2</hdl-tab>
			</hdl-tab-list>
			<hdl-tab-panel value="tab1">Content 1</hdl-tab-panel>
			<hdl-tab-panel value="tab2">Content 2</hdl-tab-panel>
		</hdl-tabs>
	`,
})
class TestHost {
	selectedTab = 'tab1';
}

describe('HdlTabs', () => {
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TestHost],
		}).compileComponents();
	});

	it('should render tab triggers', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const tabs = fixture.nativeElement.querySelectorAll('hdl-tab');
		expect(tabs.length).toBe(2);
		expect(tabs[0].textContent).toContain('Tab 1');
		expect(tabs[1].textContent).toContain('Tab 2');
	});

	it('should render tab panels', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const panels = fixture.nativeElement.querySelectorAll('hdl-tab-panel');
		expect(panels.length).toBe(2);
	});

	it('should show first panel and hide second panel by default', async () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const panels = fixture.nativeElement.querySelectorAll('hdl-tab-panel');
		expect(panels[0].hidden).toBe(false);
		expect(panels[1].hidden).toBe(true);
	});

	it('should expose styling contract attributes for tabs and panels', async () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const tabs = fixture.nativeElement.querySelector('hdl-tabs');
		const tabList = fixture.nativeElement.querySelector('hdl-tab-list');
		const tabEls = fixture.nativeElement.querySelectorAll('hdl-tab');
		const panels = fixture.nativeElement.querySelectorAll('hdl-tab-panel');

		expect(tabs.getAttribute('data-slot')).toBe('tabs');
		expect(tabList.getAttribute('data-slot')).toBe('tab-list');
		expect(tabList.getAttribute('data-orientation')).toBe('horizontal');
		expect(tabEls[0].getAttribute('data-slot')).toBe('tab');
		expect(tabEls[0].getAttribute('data-state')).toBe('selected');
		expect(tabEls[1].getAttribute('data-state')).toBe('unselected');
		expect(panels[0].getAttribute('data-slot')).toBe('tab-panel');
		expect(panels[0].getAttribute('data-state')).toBe('visible');
		expect(panels[1].getAttribute('data-state')).toBe('hidden');
	});

	it('should expose TabList directive via inject()', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const tabListDebug = fixture.debugElement.query(
			(de) => de.nativeElement.tagName === 'HDL-TAB-LIST',
		);
		const tabListComp = tabListDebug.componentInstance as HdlTabList;
		expect(tabListComp.tabList).toBeTruthy();
		expect(tabListComp.orientation()).toBe('horizontal');
	});

	it('should have no styles on host elements', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-tabs');
		expect(el.getAttribute('style')).toBeFalsy();
	});
});
