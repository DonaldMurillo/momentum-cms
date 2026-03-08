import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { HdlMenu } from './menu.component';
import { HdlMenuItem } from './menu-item.component';
import { HdlMenuTrigger } from './menu-trigger.component';

@Component({
	imports: [HdlMenu, HdlMenuItem, HdlMenuTrigger],
	template: `
		<hdl-menu-trigger>Actions</hdl-menu-trigger>
		<hdl-menu>
			<hdl-menu-item value="edit">Edit</hdl-menu-item>
			<hdl-menu-item value="delete" [disabled]="true">Delete</hdl-menu-item>
		</hdl-menu>
	`,
})
class TestHost {}

describe('HdlMenu', () => {
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TestHost],
		}).compileComponents();
	});

	it('should render menu items', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const items = fixture.nativeElement.querySelectorAll('hdl-menu-item');
		expect(items.length).toBe(2);
	});

	it('should render menu item text content', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const items = fixture.nativeElement.querySelectorAll('hdl-menu-item');
		expect(items[0].textContent).toContain('Edit');
		expect(items[1].textContent).toContain('Delete');
	});

	it('should apply disabled state to disabled menu item', async () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const items = fixture.nativeElement.querySelectorAll('hdl-menu-item');
		// The disabled item should have aria-disabled set by the MenuItem directive
		expect(items[1].getAttribute('aria-disabled')).toBe('true');
	});

	it('should expose styling contract attributes on the menu and items', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const trigger = fixture.nativeElement.querySelector('hdl-menu-trigger');
		const menu = fixture.nativeElement.querySelector('hdl-menu');
		const items = fixture.nativeElement.querySelectorAll('hdl-menu-item');

		expect(trigger.getAttribute('data-slot')).toBe('menu-trigger');
		expect(trigger.getAttribute('role')).toBe('button');
		expect(menu.getAttribute('data-slot')).toBe('menu');
		expect(menu.getAttribute('data-state')).toBe('open');
		expect(items[0].getAttribute('data-slot')).toBe('menu-item');
		expect(items[1].getAttribute('data-disabled')).toBe('true');
	});

	it('should have no styles on the host', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const el = fixture.nativeElement.querySelector('hdl-menu');
		expect(el.getAttribute('style')).toBeFalsy();
	});
});
