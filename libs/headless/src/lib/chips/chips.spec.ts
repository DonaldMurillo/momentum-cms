import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HdlChipInput } from './chip-input.component';
import { HdlChipRemove } from './chip-remove.directive';
import { HdlChip } from './chip.component';
import { HdlChips } from './chips.component';

@Component({
	imports: [HdlChips, HdlChip, HdlChipInput, HdlChipRemove],
	template: `
		<hdl-chips [(values)]="values">
			@for (value of values; track value) {
				<hdl-chip [value]="value">
					<span>{{ value }}</span>
					<button hdlChipRemove aria-label="Remove {{ value }}">x</button>
				</hdl-chip>
			}
			<input hdl-chip-input [addOnBlur]="addOnBlur" />
		</hdl-chips>
	`,
})
class ChipsHost {
	values = ['Angular', 'ARIA'];
	addOnBlur = false;
}

@Component({
	imports: [HdlChips, HdlChip, HdlChipInput],
	template: `
		<hdl-chips [(values)]="values" [allowDuplicates]="true" [disabled]="true">
			@for (value of values; track value) {
				<hdl-chip [value]="value">{{ value }}</hdl-chip>
			}
			<input hdl-chip-input />
		</hdl-chips>
	`,
})
class DisabledChipsHost {
	values = ['Locked'];
}

describe('HdlChips', () => {
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [ChipsHost, DisabledChipsHost],
		}).compileComponents();
	});

	it('exposes the chips styling contract on the host and rendered chips', () => {
		const fixture = TestBed.createComponent(ChipsHost);
		fixture.detectChanges();

		const host = fixture.nativeElement.querySelector('hdl-chips');
		const chip = fixture.nativeElement.querySelector('hdl-chip');
		const input = fixture.nativeElement.querySelector('input[hdl-chip-input]');
		const removeButton = fixture.nativeElement.querySelector('button[hdlChipRemove]');

		expect(host.getAttribute('data-slot')).toBe('chips');
		expect(host.getAttribute('role')).toBe('list');
		expect(host.getAttribute('data-empty')).toBeNull();
		expect(chip.getAttribute('data-slot')).toBe('chip');
		expect(chip.getAttribute('data-removable')).toBe('true');
		expect(input.getAttribute('data-slot')).toBe('chip-input');
		expect(removeButton.getAttribute('data-slot')).toBe('chip-remove');
	});

	it('adds a trimmed chip on separator keys and prevents duplicates by default', () => {
		const fixture = TestBed.createComponent(ChipsHost);
		fixture.detectChanges();

		const host = fixture.componentInstance;
		const input = fixture.nativeElement.querySelector('input[hdl-chip-input]') as HTMLInputElement;

		input.value = '  CMS  ';
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
		fixture.detectChanges();

		expect(host.values).toEqual(['Angular', 'ARIA', 'CMS']);
		expect(input.value).toBe('');

		input.value = 'Angular';
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
		fixture.detectChanges();

		expect(host.values).toEqual(['Angular', 'ARIA', 'CMS']);
	});

	it('removes the last chip with Backspace from an empty input and supports explicit removal buttons', () => {
		const fixture = TestBed.createComponent(ChipsHost);
		fixture.detectChanges();

		const host = fixture.componentInstance;
		const input = fixture.nativeElement.querySelector('input[hdl-chip-input]') as HTMLInputElement;

		input.value = '';
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
		fixture.detectChanges();
		expect(host.values).toEqual(['Angular']);

		const removeButton = fixture.nativeElement.querySelector(
			'button[hdlChipRemove]',
		) as HTMLButtonElement;
		removeButton.click();
		fixture.detectChanges();
		expect(host.values).toEqual([]);
		expect(fixture.nativeElement.querySelector('hdl-chips').getAttribute('data-empty')).toBe(
			'true',
		);
	});

	it('can commit chips on blur when requested', () => {
		const fixture = TestBed.createComponent(ChipsHost);
		fixture.componentInstance.addOnBlur = true;
		fixture.detectChanges();

		const host = fixture.componentInstance;
		const input = fixture.nativeElement.querySelector('input[hdl-chip-input]') as HTMLInputElement;
		input.value = 'Tokens';
		input.dispatchEvent(new FocusEvent('blur'));
		fixture.detectChanges();

		expect(host.values).toEqual(['Angular', 'ARIA', 'Tokens']);
		expect(input.value).toBe('');
	});

	it('blocks add and remove interactions when disabled', () => {
		const fixture = TestBed.createComponent(DisabledChipsHost);
		fixture.detectChanges();

		const host = fixture.componentInstance;
		const chips = fixture.nativeElement.querySelector('hdl-chips');
		const chip = fixture.nativeElement.querySelector('hdl-chip');
		const input = fixture.nativeElement.querySelector('input[hdl-chip-input]') as HTMLInputElement;

		expect(chips.getAttribute('data-disabled')).toBe('true');
		expect(chip.getAttribute('data-disabled')).toBe('true');
		expect(input.disabled).toBe(true);

		input.value = 'Blocked';
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
		fixture.detectChanges();
		expect(host.values).toEqual(['Locked']);

		chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
		fixture.detectChanges();
		expect(host.values).toEqual(['Locked']);
	});
});
