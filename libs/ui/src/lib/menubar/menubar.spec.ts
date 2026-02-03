import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Menubar } from './menubar.component';
import { MenubarItem } from './menubar-item.component';
import { MenubarSubmenu, MenubarSubmenuItem, MenubarSeparator } from './menubar-submenu.component';

describe('Menubar', () => {
	let fixture: ComponentFixture<Menubar>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [Menubar],
		}).compileComponents();

		fixture = TestBed.createComponent(Menubar);
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have role="menubar"', () => {
		expect(fixture.nativeElement.getAttribute('role')).toBe('menubar');
	});

	it('should have horizontal orientation', () => {
		expect(fixture.nativeElement.getAttribute('aria-orientation')).toBe('horizontal');
	});

	it('should have flex display', () => {
		expect(fixture.nativeElement.classList.contains('flex')).toBe(true);
	});

	it('should have items-center class', () => {
		expect(fixture.nativeElement.classList.contains('items-center')).toBe(true);
	});

	it('should have border styling', () => {
		expect(fixture.nativeElement.classList.contains('border')).toBe(true);
		expect(fixture.nativeElement.classList.contains('border-border')).toBe(true);
	});

	it('should apply custom class', () => {
		fixture.componentRef.setInput('class', 'custom-menubar');
		fixture.detectChanges();
		expect(fixture.nativeElement.classList.contains('custom-menubar')).toBe(true);
	});

	it('should default disabled to false', () => {
		expect(fixture.componentInstance.disabled()).toBe(false);
	});

	it('should default wrap to true', () => {
		expect(fixture.componentInstance.wrap()).toBe(true);
	});

	it('should default typeaheadDelay to 500', () => {
		expect(fixture.componentInstance.typeaheadDelay()).toBe(500);
	});
});

describe('MenubarItem', () => {
	// MenubarItem cannot be tested in isolation because it requires a MenuBar parent.
	// The component should be tested via integration tests.

	it('should export the component', () => {
		expect(MenubarItem).toBeDefined();
	});
});

describe('MenubarSubmenu', () => {
	// MenubarSubmenu cannot be tested in isolation because it requires proper context.
	// The component should be tested via integration tests.

	it('should export the component', () => {
		expect(MenubarSubmenu).toBeDefined();
	});
});

describe('MenubarSubmenuItem', () => {
	// MenubarSubmenuItem cannot be tested in isolation because it requires a Menu parent.
	// The component should be tested via integration tests.

	it('should export the component', () => {
		expect(MenubarSubmenuItem).toBeDefined();
	});
});

describe('MenubarSeparator', () => {
	let fixture: ComponentFixture<MenubarSeparator>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [MenubarSeparator],
		}).compileComponents();

		fixture = TestBed.createComponent(MenubarSeparator);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have role="separator"', () => {
		expect(fixture.nativeElement.getAttribute('role')).toBe('separator');
	});

	it('should have separator styling', () => {
		expect(fixture.nativeElement.classList.contains('h-px')).toBe(true);
		expect(fixture.nativeElement.classList.contains('bg-border')).toBe(true);
	});

	it('should apply custom class', () => {
		fixture.componentRef.setInput('class', 'custom-separator');
		fixture.detectChanges();
		expect(fixture.nativeElement.classList.contains('custom-separator')).toBe(true);
	});
});
