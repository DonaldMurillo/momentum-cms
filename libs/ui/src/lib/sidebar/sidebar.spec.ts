import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Sidebar } from './sidebar.component';
import { SidebarHeader } from './sidebar-header.component';
import { SidebarContent } from './sidebar-content.component';
import { SidebarFooter } from './sidebar-footer.component';
import { SidebarNav } from './sidebar-nav.component';
import { SidebarNavItem } from './sidebar-nav-item.component';
import { SidebarSection } from './sidebar-section.component';
import { SidebarService } from './sidebar.service';

@Component({
	imports: [Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarNav, SidebarNavItem],
	template: `
		<mcms-sidebar>
			<mcms-sidebar-header>Logo</mcms-sidebar-header>
			<mcms-sidebar-content>
				<mcms-sidebar-nav>
					<mcms-sidebar-nav-item label="Dashboard" href="/dashboard" />
					<mcms-sidebar-nav-item label="Settings" href="/settings" />
				</mcms-sidebar-nav>
			</mcms-sidebar-content>
			<mcms-sidebar-footer>Footer</mcms-sidebar-footer>
		</mcms-sidebar>
	`,
})
class _TestHostComponent {}

@Component({
	imports: [Sidebar, SidebarContent, SidebarNav, SidebarSection, SidebarNavItem],
	template: `
		<mcms-sidebar>
			<mcms-sidebar-content>
				<mcms-sidebar-nav>
					<mcms-sidebar-section title="Main" [collapsible]="false">
						<mcms-sidebar-nav-item label="Home" href="/" />
					</mcms-sidebar-section>
					<mcms-sidebar-section title="Settings" [collapsible]="true" [(expanded)]="expanded">
						<mcms-sidebar-nav-item label="Profile" href="/profile" />
						<mcms-sidebar-nav-item label="Security" href="/security" />
					</mcms-sidebar-section>
				</mcms-sidebar-nav>
			</mcms-sidebar-content>
		</mcms-sidebar>
	`,
})
class _TestSectionComponent {
	expanded = true;
}

describe('Sidebar', () => {
	let fixture: ComponentFixture<Sidebar>;
	let _sidebarService: SidebarService;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [Sidebar],
			providers: [provideRouter([])],
		}).compileComponents();

		_sidebarService = TestBed.inject(SidebarService);
		fixture = TestBed.createComponent(Sidebar);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should render aside element with flex column layout on desktop', () => {
		// On desktop (non-mobile), the aside element has the layout classes
		const aside = fixture.nativeElement.querySelector('aside');
		expect(aside).toBeTruthy();
		expect(aside.classList.contains('flex')).toBe(true);
		expect(aside.classList.contains('flex-col')).toBe(true);
	});

	it('should have default width of 16rem on desktop', () => {
		const aside = fixture.nativeElement.querySelector('aside');
		expect(aside.style.width).toBe('16rem');
	});

	it('should apply collapsed width when collapsed on desktop', async () => {
		// Set collapsed via input (syncs to service via effect)
		fixture.componentRef.setInput('collapsed', true);
		fixture.detectChanges();
		await fixture.whenStable();
		// Trigger another change detection cycle for the effect to run
		fixture.detectChanges();
		await fixture.whenStable();
		const aside = fixture.nativeElement.querySelector('aside');
		expect(aside.style.width).toBe('4rem');
	});
});

describe('SidebarHeader', () => {
	let fixture: ComponentFixture<SidebarHeader>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [SidebarHeader],
		}).compileComponents();

		fixture = TestBed.createComponent(SidebarHeader);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have border-bottom', () => {
		expect(fixture.nativeElement.classList.contains('border-b')).toBe(true);
	});
});

describe('SidebarContent', () => {
	let fixture: ComponentFixture<SidebarContent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [SidebarContent],
		}).compileComponents();

		fixture = TestBed.createComponent(SidebarContent);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should be scrollable', () => {
		expect(fixture.nativeElement.classList.contains('overflow-y-auto')).toBe(true);
	});

	it('should fill available space', () => {
		expect(fixture.nativeElement.classList.contains('flex-1')).toBe(true);
	});
});

describe('SidebarFooter', () => {
	let fixture: ComponentFixture<SidebarFooter>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [SidebarFooter],
		}).compileComponents();

		fixture = TestBed.createComponent(SidebarFooter);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have border-top', () => {
		expect(fixture.nativeElement.classList.contains('border-t')).toBe(true);
	});
});

describe('SidebarNav', () => {
	let fixture: ComponentFixture<SidebarNav>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [SidebarNav],
		}).compileComponents();

		fixture = TestBed.createComponent(SidebarNav);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have navigation role', () => {
		expect(fixture.nativeElement.getAttribute('role')).toBe('navigation');
	});

	it('should have flex column layout', () => {
		expect(fixture.nativeElement.classList.contains('flex')).toBe(true);
		expect(fixture.nativeElement.classList.contains('flex-col')).toBe(true);
	});
});

describe('SidebarNavItem', () => {
	let fixture: ComponentFixture<_TestHostComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [_TestHostComponent],
			providers: [provideRouter([])],
		}).compileComponents();

		fixture = TestBed.createComponent(_TestHostComponent);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should render nav items', () => {
		const items = fixture.nativeElement.querySelectorAll('mcms-sidebar-nav-item');
		expect(items.length).toBe(2);
	});

	it('should render links with href', () => {
		const links = fixture.nativeElement.querySelectorAll('mcms-sidebar-nav-item a');
		expect(links.length).toBe(2);
	});

	it('should display labels', () => {
		const firstItem = fixture.nativeElement.querySelector('mcms-sidebar-nav-item');
		expect(firstItem.textContent).toContain('Dashboard');
	});
});

describe('SidebarSection', () => {
	let fixture: ComponentFixture<_TestSectionComponent>;
	let component: _TestSectionComponent;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [_TestSectionComponent],
			providers: [provideRouter([])],
		}).compileComponents();

		fixture = TestBed.createComponent(_TestSectionComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should render sections', () => {
		const sections = fixture.nativeElement.querySelectorAll('mcms-sidebar-section');
		expect(sections.length).toBe(2);
	});

	it('should display section titles', () => {
		const titles = fixture.nativeElement.querySelectorAll('mcms-sidebar-section');
		expect(titles[0].textContent).toContain('Main');
		expect(titles[1].textContent).toContain('Settings');
	});

	it('should show items in expanded section', () => {
		const settingsSection = fixture.nativeElement.querySelectorAll('mcms-sidebar-section')[1];
		const items = settingsSection.querySelectorAll('mcms-sidebar-nav-item');
		expect(items.length).toBe(2);
	});

	it('should have collapse button for collapsible section', () => {
		const settingsSection = fixture.nativeElement.querySelectorAll('mcms-sidebar-section')[1];
		const button = settingsSection.querySelector('button');
		expect(button).toBeTruthy();
		expect(button.getAttribute('aria-expanded')).toBe('true');
	});

	it('should toggle expanded state when clicked', async () => {
		const settingsSection = fixture.nativeElement.querySelectorAll('mcms-sidebar-section')[1];
		const button = settingsSection.querySelector('button');

		button.click();
		fixture.detectChanges();
		await fixture.whenStable();

		expect(component.expanded).toBe(false);
		expect(button.getAttribute('aria-expanded')).toBe('false');
	});

	it('should hide items when collapsed', async () => {
		// Click to collapse instead of setting property directly (avoids ExpressionChangedAfterItHasBeenCheckedError)
		const settingsSection = fixture.nativeElement.querySelectorAll('mcms-sidebar-section')[1];
		const button = settingsSection.querySelector('button');
		button.click();
		fixture.detectChanges();
		await fixture.whenStable();

		const items = settingsSection.querySelectorAll('mcms-sidebar-nav-item');
		expect(items.length).toBe(0);
	});
});

describe('Sidebar Integration', () => {
	let fixture: ComponentFixture<_TestHostComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [_TestHostComponent],
			providers: [provideRouter([])],
		}).compileComponents();

		fixture = TestBed.createComponent(_TestHostComponent);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should render complete sidebar structure', () => {
		const sidebar = fixture.nativeElement.querySelector('mcms-sidebar');
		const header = fixture.nativeElement.querySelector('mcms-sidebar-header');
		const content = fixture.nativeElement.querySelector('mcms-sidebar-content');
		const footer = fixture.nativeElement.querySelector('mcms-sidebar-footer');
		const nav = fixture.nativeElement.querySelector('mcms-sidebar-nav');

		expect(sidebar).toBeTruthy();
		expect(header).toBeTruthy();
		expect(content).toBeTruthy();
		expect(footer).toBeTruthy();
		expect(nav).toBeTruthy();
	});

	it('should render header content', () => {
		const header = fixture.nativeElement.querySelector('mcms-sidebar-header');
		expect(header.textContent).toContain('Logo');
	});

	it('should render footer content', () => {
		const footer = fixture.nativeElement.querySelector('mcms-sidebar-footer');
		expect(footer.textContent).toContain('Footer');
	});
});
