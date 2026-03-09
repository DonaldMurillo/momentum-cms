import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HdlSelect } from './select.component';
import { HdlSelectTrigger } from './select-trigger.component';
import { HdlSelectValue } from './select-value.component';
import { HdlSelectContent } from './select-content.component';
import { HdlSelectItem } from './select-item.component';

@Component({
	imports: [HdlSelect, HdlSelectTrigger, HdlSelectValue, HdlSelectContent, HdlSelectItem],
	template: `
		<hdl-select [(value)]="value">
			<hdl-select-trigger>
				<hdl-select-value placeholder="Choose a status" />
			</hdl-select-trigger>
			<hdl-select-content>
				<hdl-select-item value="draft">Draft</hdl-select-item>
				<hdl-select-item value="published">Published</hdl-select-item>
			</hdl-select-content>
		</hdl-select>
	`,
})
class TestHost {
	readonly value = signal<string | null>(null);
}

describe('HdlSelect', () => {
	it('should update aria-controls on trigger after content registers', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();

		const trigger = fixture.nativeElement.querySelector('hdl-select-trigger');
		const content = fixture.nativeElement.querySelector('hdl-select-content');
		const contentId = content.getAttribute('id');

		// aria-controls must point to the content element's id
		expect(contentId).toBeTruthy();
		expect(trigger.getAttribute('aria-controls')).toBe(contentId);
	});

	it('should expose option directive publicly on HdlSelectItem', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();

		const selectItemDebug = fixture.debugElement.query(
			(de) => de.nativeElement.tagName === 'HDL-SELECT-ITEM',
		);
		const selectItemComponent = selectItemDebug.componentInstance as HdlSelectItem;

		// The option directive must be accessible (public, not protected)
		// and must be the actual @angular/aria Option directive instance
		expect(selectItemComponent.option).toBeDefined();
		expect(selectItemComponent.option.selected).toBeDefined();
	});

	it('should open from the trigger and reflect the selected label', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();

		const trigger = fixture.nativeElement.querySelector('hdl-select-trigger');
		const content = fixture.nativeElement.querySelector('hdl-select-content');
		const items = fixture.nativeElement.querySelectorAll('hdl-select-item');

		expect(content.hasAttribute('hidden')).toBe(true);

		trigger.click();
		fixture.detectChanges();
		expect(content.hasAttribute('hidden')).toBe(false);

		items[1].click();
		fixture.detectChanges();

		expect(trigger.textContent).toContain('Published');
		expect(content.hasAttribute('hidden')).toBe(true);
	});
});
