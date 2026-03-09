import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HdlToggle } from './toggle.component';
import { HdlToggleGroup } from './toggle-group.component';
import { HdlToggleItem } from './toggle-item.component';

@Component({
	imports: [HdlToggle],
	template: `<hdl-toggle [(pressed)]="pressed">Mute</hdl-toggle>`,
})
class ToggleHost {
	readonly pressed = signal(false);
}

@Component({
	imports: [HdlToggleGroup, HdlToggleItem],
	template: `
		<hdl-toggle-group [multiple]="true" [(values)]="values">
			<hdl-toggle-item value="bold">Bold</hdl-toggle-item>
			<hdl-toggle-item value="italic">Italic</hdl-toggle-item>
			<hdl-toggle-item value="underline" [disabled]="true">Underline</hdl-toggle-item>
		</hdl-toggle-group>
	`,
})
class ToggleGroupHost {
	readonly values = signal<string[]>(['bold']);
}

describe('HdlToggle', () => {
	it('should toggle standalone pressed state', () => {
		const fixture = TestBed.createComponent(ToggleHost);
		fixture.detectChanges();

		const toggle = fixture.nativeElement.querySelector('hdl-toggle');
		expect(toggle.getAttribute('aria-pressed')).toBe('false');

		toggle.click();
		fixture.detectChanges();

		expect(toggle.getAttribute('aria-pressed')).toBe('true');
	});

	it('should support multi-select toggle groups and roving focus', () => {
		const fixture = TestBed.createComponent(ToggleGroupHost);
		fixture.detectChanges();

		const items = fixture.nativeElement.querySelectorAll('hdl-toggle-item');
		expect(items[0].getAttribute('aria-pressed')).toBe('true');
		expect(items[0].getAttribute('tabindex')).toBe('0');
		expect(items[1].getAttribute('tabindex')).toBe('-1');

		items[1].click();
		fixture.detectChanges();
		expect(items[1].getAttribute('aria-pressed')).toBe('true');

		items[0].focus();
		fixture.nativeElement
			.querySelector('hdl-toggle-group')
			.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
		fixture.detectChanges();

		expect(document.activeElement).toBe(items[1]);
	});
});
