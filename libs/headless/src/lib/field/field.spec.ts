import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HdlDescription } from './description.component';
import { HdlError } from './error.component';
import { HdlField } from './field.component';
import { HdlLabel } from './label.component';
import { HdlInput } from '../input/input.component';
import { HdlTextarea } from '../textarea/textarea.component';

@Component({
	imports: [HdlField, HdlLabel, HdlDescription, HdlError, HdlInput],
	template: `
		<hdl-field [invalid]="true" [required]="true">
			<hdl-label>Display name</hdl-label>
			<input hdl-input />
			@if (showDescription()) {
				<hdl-description>Public profile label.</hdl-description>
			}
			<hdl-error>Display name is required.</hdl-error>
		</hdl-field>
	`,
})
class InputFieldHost {
	readonly showDescription = signal(true);
}

@Component({
	imports: [HdlField, HdlLabel, HdlTextarea],
	template: `
		<hdl-field [disabled]="true">
			<hdl-label>Notes</hdl-label>
			<textarea hdl-textarea></textarea>
		</hdl-field>
	`,
})
class TextareaFieldHost {}

@Component({
	imports: [HdlField, HdlInput],
	template: `
		<hdl-field>
			<input hdl-input id="explicit-id" />
		</hdl-field>
	`,
})
class ExplicitInputIdHost {}

describe('HdlField primitives', () => {
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [InputFieldHost, TextareaFieldHost, ExplicitInputIdHost],
		}).compileComponents();
	});

	it('connects label, description, and error state to an input control', async () => {
		const fixture = TestBed.createComponent(InputFieldHost);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const field = fixture.nativeElement.querySelector('hdl-field');
		const label = fixture.nativeElement.querySelector('hdl-label');
		const input = fixture.nativeElement.querySelector('input[hdl-input]');
		const description = fixture.nativeElement.querySelector('hdl-description');
		const error = fixture.nativeElement.querySelector('hdl-error');

		expect(field.getAttribute('data-slot')).toBe('field');
		expect(field.getAttribute('data-invalid')).toBe('true');
		expect(field.getAttribute('data-required')).toBe('true');
		expect(label.getAttribute('data-slot')).toBe('label');
		expect(label.getAttribute('for')).toBe(input.id);
		expect(input.getAttribute('data-slot')).toBe('input');
		expect(input.getAttribute('data-invalid')).toBe('true');
		expect(input.getAttribute('data-required')).toBe('true');
		expect(input.getAttribute('aria-invalid')).toBe('true');
		expect(input.getAttribute('aria-describedby')).toBe(`${description.id} ${error.id}`);
		expect(input.getAttribute('aria-errormessage')).toBe(error.id);
	});

	it('removes description ids from aria-describedby when the description is removed', async () => {
		const fixture = TestBed.createComponent(InputFieldHost);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const host = fixture.componentInstance;
		const error = fixture.nativeElement.querySelector('hdl-error');
		host.showDescription.set(false);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const input = fixture.nativeElement.querySelector('input[hdl-input]');
		expect(fixture.nativeElement.querySelector('hdl-description')).toBeNull();
		expect(input.getAttribute('aria-describedby')).toBe(error.id);
	});

	it('inherits disabled state on textarea controls and exposes the textarea styling contract', async () => {
		const fixture = TestBed.createComponent(TextareaFieldHost);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const field = fixture.nativeElement.querySelector('hdl-field');
		const label = fixture.nativeElement.querySelector('hdl-label');
		const textarea = fixture.nativeElement.querySelector('textarea[hdl-textarea]');

		expect(field.getAttribute('data-disabled')).toBe('true');
		expect(textarea.getAttribute('data-slot')).toBe('textarea');
		expect(textarea.getAttribute('data-disabled')).toBe('true');
		expect(textarea.disabled).toBe(true);
		expect(label.getAttribute('for')).toBe(textarea.id);
	});

	it('preserves an explicit control id instead of forcing the field-generated id', async () => {
		const fixture = TestBed.createComponent(ExplicitInputIdHost);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const input = fixture.nativeElement.querySelector('input[hdl-input]');
		expect(input.id).toBe('explicit-id');
	});
});
