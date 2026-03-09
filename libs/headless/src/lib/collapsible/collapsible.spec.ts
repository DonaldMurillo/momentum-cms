import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HdlCollapsible } from './collapsible.component';
import { HdlCollapsibleTrigger } from './collapsible-trigger.component';
import { HdlCollapsibleContent } from './collapsible-content.component';

@Component({
	imports: [HdlCollapsible, HdlCollapsibleTrigger, HdlCollapsibleContent],
	template: `
		<hdl-collapsible>
			<hdl-collapsible-trigger>Details</hdl-collapsible-trigger>
			<hdl-collapsible-content>Body</hdl-collapsible-content>
		</hdl-collapsible>
	`,
})
class TestHost {}

describe('HdlCollapsible', () => {
	it('should update aria-controls on trigger after content registers', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();

		const trigger = fixture.nativeElement.querySelector('hdl-collapsible-trigger');
		const content = fixture.nativeElement.querySelector('hdl-collapsible-content');
		const contentId = content.getAttribute('id');

		expect(contentId).toBeTruthy();
		expect(trigger.getAttribute('aria-controls')).toBe(contentId);
	});

	it('should expose collapsed state by default', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();

		const root = fixture.nativeElement.querySelector('hdl-collapsible');
		const trigger = fixture.nativeElement.querySelector('hdl-collapsible-trigger');
		const content = fixture.nativeElement.querySelector('hdl-collapsible-content');

		expect(root.getAttribute('data-state')).toBe('closed');
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
		expect(content.hasAttribute('hidden')).toBe(true);
	});

	it('should toggle content from click and keyboard', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();

		const trigger: HTMLElement = fixture.nativeElement.querySelector('hdl-collapsible-trigger');
		const content = fixture.nativeElement.querySelector('hdl-collapsible-content');

		trigger.click();
		fixture.detectChanges();
		expect(content.hasAttribute('hidden')).toBe(false);

		trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
		fixture.detectChanges();
		expect(content.hasAttribute('hidden')).toBe(true);
	});
});
