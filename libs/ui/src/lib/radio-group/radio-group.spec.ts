import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RadioGroup } from './radio-group.component';
import type { RadioOption } from './radio-group.types';

@Component({
	template: `<mcms-radio-group
		[options]="options()"
		[(value)]="value"
		[disabled]="disabled()"
		[required]="required()"
	/>`,
	imports: [RadioGroup],
})
class RadioGroupTestHost {
	readonly value = signal('');
	readonly disabled = signal(false);
	readonly required = signal(false);
	readonly options = signal<RadioOption[]>([
		{ value: 'a', label: 'Option A' },
		{ value: 'b', label: 'Option B' },
		{ value: 'c', label: 'Option C' },
	]);
}

@Component({
	template: `<mcms-radio-group [options]="options()" [(value)]="value" />`,
	imports: [RadioGroup],
})
class RadioGroupWithDisabledTestHost {
	readonly value = signal('');
	readonly options = signal<RadioOption[]>([
		{ value: 'a', label: 'Option A', disabled: true },
		{ value: 'b', label: 'Option B' },
		{ value: 'c', label: 'Option C' },
	]);
}

describe('RadioGroup', () => {
	let fixture: ComponentFixture<RadioGroupTestHost>;
	let hostEl: HTMLElement;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [RadioGroupTestHost],
		}).compileComponents();

		fixture = TestBed.createComponent(RadioGroupTestHost);
		fixture.detectChanges();
		await fixture.whenStable();
		hostEl = fixture.nativeElement.querySelector('mcms-radio-group');
	});

	function getRadioButtons(): HTMLButtonElement[] {
		return Array.from(hostEl.querySelectorAll<HTMLButtonElement>('button[role="radio"]'));
	}

	it('should create', () => {
		expect(hostEl).toBeTruthy();
	});

	it('should have role="radiogroup"', () => {
		expect(hostEl.getAttribute('role')).toBe('radiogroup');
	});

	describe('roving tabindex', () => {
		it('should give first non-disabled option tabindex=0 when no value selected', () => {
			const buttons = getRadioButtons();
			expect(buttons[0].getAttribute('tabindex')).toBe('0');
			expect(buttons[1].getAttribute('tabindex')).toBe('-1');
			expect(buttons[2].getAttribute('tabindex')).toBe('-1');
		});

		it('should give selected option tabindex=0 and others -1', () => {
			fixture.componentInstance.value.set('b');
			fixture.detectChanges();

			const buttons = getRadioButtons();
			expect(buttons[0].getAttribute('tabindex')).toBe('-1');
			expect(buttons[1].getAttribute('tabindex')).toBe('0');
			expect(buttons[2].getAttribute('tabindex')).toBe('-1');
		});

		it('should give first non-disabled option tabindex=0 when first option is disabled', async () => {
			const disabledFixture = TestBed.createComponent(RadioGroupWithDisabledTestHost);
			disabledFixture.detectChanges();
			await disabledFixture.whenStable();

			const el: HTMLElement = disabledFixture.nativeElement.querySelector('mcms-radio-group');
			const buttons = el.querySelectorAll('button[role="radio"]');
			// First option is disabled, so second gets tabindex=0
			expect(buttons[0].getAttribute('tabindex')).toBe('-1');
			expect(buttons[1].getAttribute('tabindex')).toBe('0');
		});
	});

	describe('arrow key navigation', () => {
		it('should move to next option on ArrowDown', () => {
			fixture.componentInstance.value.set('a');
			fixture.detectChanges();

			hostEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
			fixture.detectChanges();

			expect(fixture.componentInstance.value()).toBe('b');
			const buttons = getRadioButtons();
			expect(buttons[1].getAttribute('tabindex')).toBe('0');
		});

		it('should move to next option on ArrowRight', () => {
			fixture.componentInstance.value.set('a');
			fixture.detectChanges();

			hostEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
			fixture.detectChanges();

			expect(fixture.componentInstance.value()).toBe('b');
		});

		it('should move to previous option on ArrowUp', () => {
			fixture.componentInstance.value.set('b');
			fixture.detectChanges();

			hostEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
			fixture.detectChanges();

			expect(fixture.componentInstance.value()).toBe('a');
		});

		it('should move to previous option on ArrowLeft', () => {
			fixture.componentInstance.value.set('b');
			fixture.detectChanges();

			hostEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
			fixture.detectChanges();

			expect(fixture.componentInstance.value()).toBe('a');
		});

		it('should wrap from last to first on ArrowDown', () => {
			fixture.componentInstance.value.set('c');
			fixture.detectChanges();

			hostEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
			fixture.detectChanges();

			expect(fixture.componentInstance.value()).toBe('a');
		});

		it('should wrap from first to last on ArrowUp', () => {
			fixture.componentInstance.value.set('a');
			fixture.detectChanges();

			hostEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
			fixture.detectChanges();

			expect(fixture.componentInstance.value()).toBe('c');
		});

		it('should skip disabled options', async () => {
			const disabledFixture = TestBed.createComponent(RadioGroupWithDisabledTestHost);
			disabledFixture.detectChanges();
			await disabledFixture.whenStable();

			disabledFixture.componentInstance.value.set('b');
			disabledFixture.detectChanges();

			const el = disabledFixture.nativeElement.querySelector('mcms-radio-group');
			// ArrowUp from 'b' should skip disabled 'a' and wrap to 'c'
			el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
			disabledFixture.detectChanges();

			expect(disabledFixture.componentInstance.value()).toBe('c');
		});
	});

	describe('aria-required', () => {
		it('should not have aria-required by default', () => {
			expect(hostEl.getAttribute('aria-required')).toBeNull();
		});

		it('should set aria-required when required', () => {
			fixture.componentInstance.required.set(true);
			fixture.detectChanges();

			expect(hostEl.getAttribute('aria-required')).toBe('true');
		});
	});

	describe('selection via click', () => {
		it('should select option on click', () => {
			const buttons = getRadioButtons();
			buttons[1].click();
			fixture.detectChanges();

			expect(fixture.componentInstance.value()).toBe('b');
			expect(buttons[1].getAttribute('aria-checked')).toBe('true');
		});

		it('should not select when disabled', () => {
			fixture.componentInstance.disabled.set(true);
			fixture.detectChanges();

			const buttons = getRadioButtons();
			buttons[1].click();
			fixture.detectChanges();

			expect(fixture.componentInstance.value()).toBe('');
		});
	});
});
