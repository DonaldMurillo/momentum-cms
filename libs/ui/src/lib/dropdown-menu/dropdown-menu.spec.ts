import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OverlayModule } from '@angular/cdk/overlay';
import { A11yModule } from '@angular/cdk/a11y';
import { DropdownLabel } from './dropdown-label.component';
import { DropdownMenu } from './dropdown-menu.component';
import { DropdownMenuItem } from './dropdown-menu-item.component';
import { DropdownSeparator } from './dropdown-separator.component';
import { DropdownTrigger } from './dropdown-trigger.directive';

@Component({
	selector: 'mcms-test-host',
	imports: [DropdownTrigger, DropdownMenu, DropdownMenuItem, DropdownSeparator, DropdownLabel],
	template: `
		<button
			[mcmsDropdownTrigger]="menuContent"
			[dropdownSide]="side"
			[dropdownAlign]="align"
			[dropdownDisabled]="disabled"
		>
			Open Menu
		</button>

		<ng-template #menuContent>
			<mcms-dropdown-menu>
				<mcms-dropdown-label>Actions</mcms-dropdown-label>
				<button mcms-dropdown-item (selected)="onSelect('item1')">Item 1</button>
				<button mcms-dropdown-item (selected)="onSelect('item2')">Item 2</button>
				<mcms-dropdown-separator />
				<button mcms-dropdown-item [disabled]="true">Disabled Item</button>
			</mcms-dropdown-menu>
		</ng-template>
	`,
})
class TestHostComponent {
	side: 'top' | 'right' | 'bottom' | 'left' = 'bottom';
	align: 'start' | 'center' | 'end' = 'start';
	disabled = false;
	selectedItem: string | null = null;

	onSelect(item: string): void {
		this.selectedItem = item;
	}
}

describe('DropdownTrigger', () => {
	let fixture: ComponentFixture<TestHostComponent>;
	let component: TestHostComponent;
	let buttonElement: HTMLButtonElement;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TestHostComponent, OverlayModule, A11yModule],
		}).compileComponents();

		fixture = TestBed.createComponent(TestHostComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();

		buttonElement = fixture.nativeElement.querySelector('button');
	});

	afterEach(() => {
		const overlayContainer = document.querySelector('.cdk-overlay-container');
		if (overlayContainer) {
			while (overlayContainer.firstChild) {
				overlayContainer.removeChild(overlayContainer.firstChild);
			}
		}
	});

	it('should create', () => {
		expect(component).toBeTruthy();
		expect(buttonElement).toBeTruthy();
	});

	it('should have aria-expanded="false" initially', () => {
		expect(buttonElement.getAttribute('aria-expanded')).toBe('false');
	});

	it('should have aria-haspopup="menu"', () => {
		expect(buttonElement.getAttribute('aria-haspopup')).toBe('menu');
	});
});

describe('DropdownMenu', () => {
	let fixture: ComponentFixture<DropdownMenu>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [DropdownMenu, A11yModule],
		}).compileComponents();

		fixture = TestBed.createComponent(DropdownMenu);
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have role="menu"', () => {
		expect(fixture.nativeElement.getAttribute('role')).toBe('menu');
	});

	it('should have aria-orientation="vertical"', () => {
		expect(fixture.nativeElement.getAttribute('aria-orientation')).toBe('vertical');
	});
});

describe('DropdownMenuItem', () => {
	let fixture: ComponentFixture<DropdownMenuItem>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [DropdownMenuItem],
		}).compileComponents();

		fixture = TestBed.createComponent(DropdownMenuItem);
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have role="menuitem"', () => {
		expect(fixture.nativeElement.getAttribute('role')).toBe('menuitem');
	});

	it('should be focusable by default', () => {
		expect(fixture.nativeElement.getAttribute('tabindex')).toBe('0');
	});

	it('should not be focusable when disabled', () => {
		fixture.componentRef.setInput('disabled', true);
		fixture.detectChanges();

		expect(fixture.nativeElement.getAttribute('tabindex')).toBe('-1');
		expect(fixture.nativeElement.getAttribute('aria-disabled')).toBe('true');
	});

	it('should display shortcut when provided', () => {
		fixture.componentRef.setInput('shortcut', '⌘K');
		fixture.detectChanges();

		const shortcut = fixture.nativeElement.querySelector('.dropdown-shortcut');
		expect(shortcut?.textContent).toBe('⌘K');
	});
});

describe('DropdownSeparator', () => {
	let fixture: ComponentFixture<DropdownSeparator>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [DropdownSeparator],
		}).compileComponents();

		fixture = TestBed.createComponent(DropdownSeparator);
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have role="separator"', () => {
		expect(fixture.nativeElement.getAttribute('role')).toBe('separator');
	});
});

describe('DropdownLabel', () => {
	let fixture: ComponentFixture<DropdownLabel>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [DropdownLabel],
		}).compileComponents();

		fixture = TestBed.createComponent(DropdownLabel);
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});
});
