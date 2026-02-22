import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CheckboxFieldRenderer } from '../checkbox-field.component';
import { createMockFieldNodeState, createMockField } from './test-helpers';

describe('CheckboxFieldRenderer', () => {
	let fixture: ComponentFixture<CheckboxFieldRenderer>;
	let component: CheckboxFieldRenderer;

	function setup(
		fieldOverrides: Record<string, unknown> = {},
		initialValue: unknown = false,
	): ReturnType<typeof createMockFieldNodeState> {
		const mock = createMockFieldNodeState(initialValue);
		TestBed.configureTestingModule({
			imports: [CheckboxFieldRenderer],
		}).compileComponents();

		fixture = TestBed.createComponent(CheckboxFieldRenderer);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('field', createMockField('checkbox', fieldOverrides));
		fixture.componentRef.setInput('path', 'isActive');
		fixture.componentRef.setInput('formNode', mock.node);
		fixture.detectChanges();
		return mock;
	}

	it('should create the component', () => {
		setup();
		expect(component).toBeTruthy();
	});

	describe('boolValue', () => {
		it('should return true for boolean true', () => {
			setup({}, true);
			expect(component.boolValue()).toBe(true);
		});

		it('should return true for string "true"', () => {
			setup({}, 'true');
			expect(component.boolValue()).toBe(true);
		});

		it('should return false for boolean false', () => {
			setup({}, false);
			expect(component.boolValue()).toBe(false);
		});

		it('should return false for null', () => {
			setup({}, null);
			expect(component.boolValue()).toBe(false);
		});

		it('should return false for undefined', () => {
			setup({}, undefined);
			expect(component.boolValue()).toBe(false);
		});

		it('should return false for arbitrary string', () => {
			setup({}, 'yes');
			expect(component.boolValue()).toBe(false);
		});
	});

	describe('disabled state', () => {
		it('should be disabled in view mode', () => {
			const mock = createMockFieldNodeState(false);
			TestBed.configureTestingModule({ imports: [CheckboxFieldRenderer] }).compileComponents();
			fixture = TestBed.createComponent(CheckboxFieldRenderer);
			component = fixture.componentInstance;
			fixture.componentRef.setInput('field', createMockField('checkbox'));
			fixture.componentRef.setInput('path', 'test');
			fixture.componentRef.setInput('formNode', mock.node);
			fixture.componentRef.setInput('mode', 'view');
			fixture.detectChanges();
			expect(component.isDisabled()).toBe(true);
		});

		it('should be disabled when readOnly', () => {
			setup({ admin: { readOnly: true } });
			expect(component.isDisabled()).toBe(true);
		});
	});

	describe('onValueChange', () => {
		it('should set value and mark as touched', () => {
			const mock = setup();
			component.onValueChange(true);
			expect(mock.state.value()).toBe(true);
			expect(mock.state.markAsTouched).toHaveBeenCalled();
		});

		it('should set false value', () => {
			const mock = setup({}, true);
			component.onValueChange(false);
			expect(mock.state.value()).toBe(false);
		});
	});

	describe('label', () => {
		it('should use field label when provided', () => {
			setup({ label: 'Is Active' });
			expect(component.label()).toBe('Is Active');
		});
	});

	describe('touchedErrors', () => {
		it('should return empty when not touched', () => {
			setup();
			expect(component.touchedErrors()).toEqual([]);
		});
	});
});
