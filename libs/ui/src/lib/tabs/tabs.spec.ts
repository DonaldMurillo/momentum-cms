import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Tabs } from './tabs.component';
import { TabsList } from './tabs-list.component';
import { TabsTrigger } from './tabs-trigger.component';
import { TabsContent } from './tabs-content.component';

@Component({
	imports: [Tabs, TabsList, TabsTrigger, TabsContent],
	template: `
		<mcms-tabs>
			<mcms-tabs-list [(selectedTab)]="selectedTab">
				<mcms-tabs-trigger value="tab1">Tab 1</mcms-tabs-trigger>
				<mcms-tabs-trigger value="tab2">Tab 2</mcms-tabs-trigger>
				<mcms-tabs-trigger value="tab3" [disabled]="true">Tab 3</mcms-tabs-trigger>
			</mcms-tabs-list>
			<mcms-tabs-content value="tab1">Content 1</mcms-tabs-content>
			<mcms-tabs-content value="tab2">Content 2</mcms-tabs-content>
			<mcms-tabs-content value="tab3">Content 3</mcms-tabs-content>
		</mcms-tabs>
	`,
})
class _TestHostComponent {
	selectedTab = 'tab1';
}

@Component({
	imports: [Tabs, TabsList, TabsTrigger, TabsContent],
	template: `
		<mcms-tabs>
			<mcms-tabs-list [(selectedTab)]="selectedTab" orientation="horizontal">
				<mcms-tabs-trigger value="tab1">Tab 1</mcms-tabs-trigger>
				<mcms-tabs-trigger value="tab2">Tab 2</mcms-tabs-trigger>
			</mcms-tabs-list>
			<mcms-tabs-content value="tab1">Content 1</mcms-tabs-content>
			<mcms-tabs-content value="tab2">Content 2</mcms-tabs-content>
		</mcms-tabs>
	`,
})
class _TestHorizontalTabsComponent {
	selectedTab = 'tab1';
}

@Component({
	imports: [Tabs, TabsList, TabsTrigger, TabsContent],
	template: `
		<mcms-tabs>
			<mcms-tabs-list [(selectedTab)]="selectedTab" orientation="vertical">
				<mcms-tabs-trigger value="tab1">Tab 1</mcms-tabs-trigger>
				<mcms-tabs-trigger value="tab2">Tab 2</mcms-tabs-trigger>
			</mcms-tabs-list>
			<mcms-tabs-content value="tab1">Content 1</mcms-tabs-content>
			<mcms-tabs-content value="tab2">Content 2</mcms-tabs-content>
		</mcms-tabs>
	`,
})
class _TestVerticalTabsComponent {
	selectedTab = 'tab1';
}

@Component({
	imports: [Tabs, TabsList, TabsTrigger, TabsContent],
	template: `
		<mcms-tabs>
			<mcms-tabs-list selectedTab="tab2">
				<mcms-tabs-trigger value="tab1">Tab 1</mcms-tabs-trigger>
				<mcms-tabs-trigger value="tab2">Tab 2</mcms-tabs-trigger>
			</mcms-tabs-list>
			<mcms-tabs-content value="tab1">Content 1</mcms-tabs-content>
			<mcms-tabs-content value="tab2">Content 2</mcms-tabs-content>
		</mcms-tabs>
	`,
})
class _TestTab2SelectedComponent {}

describe('Tabs', () => {
	let fixture: ComponentFixture<Tabs>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [Tabs],
		}).compileComponents();

		fixture = TestBed.createComponent(Tabs);
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should be a block element', () => {
		expect(fixture.nativeElement.classList.contains('block')).toBe(true);
	});
});

describe('TabsList', () => {
	describe('horizontal orientation', () => {
		let fixture: ComponentFixture<_TestHorizontalTabsComponent>;

		beforeEach(async () => {
			await TestBed.configureTestingModule({
				imports: [_TestHorizontalTabsComponent],
			}).compileComponents();

			fixture = TestBed.createComponent(_TestHorizontalTabsComponent);
			fixture.detectChanges();
			await fixture.whenStable();
		});

		it('should create', () => {
			const tabsList = fixture.nativeElement.querySelector('mcms-tabs-list');
			expect(tabsList).toBeTruthy();
		});

		it('should have horizontal styling', () => {
			const tabsList = fixture.nativeElement.querySelector('mcms-tabs-list');
			expect(tabsList.classList.contains('h-9')).toBe(true);
			expect(tabsList.classList.contains('flex-col')).toBe(false);
		});

		it('should have muted background', () => {
			const tabsList = fixture.nativeElement.querySelector('mcms-tabs-list');
			expect(tabsList.classList.contains('bg-muted')).toBe(true);
		});

		it('should have rounded styling', () => {
			const tabsList = fixture.nativeElement.querySelector('mcms-tabs-list');
			expect(tabsList.classList.contains('rounded-lg')).toBe(true);
		});
	});

	describe('vertical orientation', () => {
		let fixture: ComponentFixture<_TestVerticalTabsComponent>;

		beforeEach(async () => {
			await TestBed.configureTestingModule({
				imports: [_TestVerticalTabsComponent],
			}).compileComponents();

			fixture = TestBed.createComponent(_TestVerticalTabsComponent);
			fixture.detectChanges();
			await fixture.whenStable();
		});

		it('should have vertical styling', () => {
			const tabsList = fixture.nativeElement.querySelector('mcms-tabs-list');
			expect(tabsList.classList.contains('flex-col')).toBe(true);
			expect(tabsList.classList.contains('h-auto')).toBe(true);
		});
	});
});

describe('TabsTrigger', () => {
	let fixture: ComponentFixture<_TestHostComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [_TestHostComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(_TestHostComponent);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should create', () => {
		const triggers = fixture.nativeElement.querySelectorAll('mcms-tabs-trigger');
		expect(triggers.length).toBe(3);
	});

	it('should have base styling classes', () => {
		const trigger = fixture.nativeElement.querySelector('mcms-tabs-trigger');
		expect(trigger.classList.contains('inline-flex')).toBe(true);
		expect(trigger.classList.contains('items-center')).toBe(true);
	});

	it('should have role="tab"', () => {
		const trigger = fixture.nativeElement.querySelector('mcms-tabs-trigger');
		expect(trigger.getAttribute('role')).toBe('tab');
	});

	it('should indicate disabled state', () => {
		const disabledTrigger = fixture.nativeElement.querySelector('mcms-tabs-trigger[value="tab3"]');
		expect(disabledTrigger.getAttribute('aria-disabled')).toBe('true');
	});
});

describe('TabsContent', () => {
	let fixture: ComponentFixture<_TestHostComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [_TestHostComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(_TestHostComponent);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should create', () => {
		const contents = fixture.nativeElement.querySelectorAll('mcms-tabs-content');
		expect(contents.length).toBe(3);
	});

	it('should have role="tabpanel"', () => {
		const content = fixture.nativeElement.querySelector('mcms-tabs-content');
		expect(content.getAttribute('role')).toBe('tabpanel');
	});

	it('should have focus-visible ring styling', () => {
		const content = fixture.nativeElement.querySelector('mcms-tabs-content');
		expect(content.classList.contains('ring-offset-background')).toBe(true);
	});

	it('should show selected content', () => {
		const content1 = fixture.nativeElement.querySelector('mcms-tabs-content[value="tab1"]');
		expect(content1.hidden).toBe(false);
	});

	it('should hide non-selected content', () => {
		const content2 = fixture.nativeElement.querySelector('mcms-tabs-content[value="tab2"]');
		expect(content2.hidden).toBe(true);
	});
});

describe('Tabs Integration', () => {
	describe('with tab1 selected', () => {
		let fixture: ComponentFixture<_TestHostComponent>;

		beforeEach(async () => {
			await TestBed.configureTestingModule({
				imports: [_TestHostComponent],
			}).compileComponents();

			fixture = TestBed.createComponent(_TestHostComponent);
			fixture.detectChanges();
			await fixture.whenStable();
		});

		it('should render all tabs', () => {
			const triggers = fixture.nativeElement.querySelectorAll('mcms-tabs-trigger');
			expect(triggers.length).toBe(3);
		});

		it('should render all content panels', () => {
			const panels = fixture.nativeElement.querySelectorAll('mcms-tabs-content');
			expect(panels.length).toBe(3);
		});

		it('should show first tab content by default', () => {
			const panel1 = fixture.nativeElement.querySelector('mcms-tabs-content[value="tab1"]');
			expect(panel1.hidden).toBe(false);
		});

		it('should mark selected tab as active', () => {
			const selectedTrigger = fixture.nativeElement.querySelector(
				'mcms-tabs-trigger[value="tab1"]',
			);
			expect(selectedTrigger.getAttribute('aria-selected')).toBe('true');
		});

		it('should hide non-selected content', () => {
			const panel2 = fixture.nativeElement.querySelector('mcms-tabs-content[value="tab2"]');
			expect(panel2.hidden).toBe(true);
		});
	});

	describe('with tab2 selected', () => {
		let fixture: ComponentFixture<_TestTab2SelectedComponent>;

		beforeEach(async () => {
			await TestBed.configureTestingModule({
				imports: [_TestTab2SelectedComponent],
			}).compileComponents();

			fixture = TestBed.createComponent(_TestTab2SelectedComponent);
			fixture.detectChanges();
			await fixture.whenStable();
		});

		it('should show tab2 content when selected', () => {
			const panel2 = fixture.nativeElement.querySelector('mcms-tabs-content[value="tab2"]');
			expect(panel2.hidden).toBe(false);
		});

		it('should hide tab1 content when tab2 is selected', () => {
			const panel1 = fixture.nativeElement.querySelector('mcms-tabs-content[value="tab1"]');
			expect(panel1.hidden).toBe(true);
		});

		it('should mark tab2 as active', () => {
			const trigger2 = fixture.nativeElement.querySelector('mcms-tabs-trigger[value="tab2"]');
			expect(trigger2.getAttribute('aria-selected')).toBe('true');
		});

		it('should mark tab1 as not active', () => {
			const trigger1 = fixture.nativeElement.querySelector('mcms-tabs-trigger[value="tab1"]');
			expect(trigger1.getAttribute('aria-selected')).toBe('false');
		});
	});
});
