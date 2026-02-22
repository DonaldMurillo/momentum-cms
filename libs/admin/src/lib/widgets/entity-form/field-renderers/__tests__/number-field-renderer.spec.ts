import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NumberFieldRenderer } from '../number-field.component';
import { createMockFieldNodeState, createMockField } from './test-helpers';

describe('NumberFieldRenderer', () => {
	let fixture: ComponentFixture<NumberFieldRenderer>;
	let component: NumberFieldRenderer;

	function setup(
		fieldOverrides: Record<string, unknown> = {},
		initialValue: unknown = null,
	): ReturnType<typeof createMockFieldNodeState> {
		const mock = createMockFieldNodeState(initialValue);
		TestBed.configureTestingModule({
			imports: [NumberFieldRenderer],
		}).compileComponents();

		fixture = TestBed.createComponent(NumberFieldRenderer);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('field', createMockField('number', fieldOverrides));
		fixture.componentRef.setInput('path', 'quantity');
		fixture.componentRef.setInput('formNode', mock.node);
		fixture.detectChanges();
		return mock;
	}

	it('should create the component', () => {
		setup();
		expect(component).toBeTruthy();
	});

	describe('stringValue', () => {
		it('should convert number to string', () => {
			setup({}, 42);
			expect(component.stringValue()).toBe('42');
		});

		it('should return empty string for null', () => {
			setup({}, null);
			expect(component.stringValue()).toBe('');
		});

		it('should return empty string for undefined', () => {
			setup({}, undefined);
			expect(component.stringValue()).toBe('');
		});
	});

	describe('min/max/step', () => {
		it('should return min from number field', () => {
			setup({ min: 0 });
			expect(component.minValue()).toBe(0);
		});

		it('should return max from number field', () => {
			setup({ max: 100 });
			expect(component.maxValue()).toBe(100);
		});

		it('should return step from number field', () => {
			setup({ step: 0.5 });
			expect(component.stepValue()).toBe(0.5);
		});

		it('should return undefined for non-number field', () => {
			const mock = createMockFieldNodeState(null);
			TestBed.configureTestingModule({ imports: [NumberFieldRenderer] }).compileComponents();
			fixture = TestBed.createComponent(NumberFieldRenderer);
			component = fixture.componentInstance;
			fixture.componentRef.setInput('field', createMockField('text'));
			fixture.componentRef.setInput('path', 'test');
			fixture.componentRef.setInput('formNode', mock.node);
			fixture.detectChanges();
			expect(component.minValue()).toBeUndefined();
			expect(component.maxValue()).toBeUndefined();
			expect(component.stepValue()).toBeUndefined();
		});
	});

	describe('rangeHint', () => {
		it('should show min-max range', () => {
			setup({ min: 0, max: 100 });
			expect(component.rangeHint()).toBe('0 - 100');
		});

		it('should show min only', () => {
			setup({ min: 0 });
			expect(component.rangeHint()).toBe('Min: 0');
		});

		it('should show max only', () => {
			setup({ max: 100 });
			expect(component.rangeHint()).toBe('Max: 100');
		});

		it('should append step', () => {
			setup({ min: 0, max: 100, step: 5 });
			expect(component.rangeHint()).toBe('0 - 100 | Step: 5');
		});

		it('should return empty for no constraints', () => {
			setup();
			expect(component.rangeHint()).toBe('');
		});
	});

	describe('onValueChange', () => {
		it('should set numeric value', () => {
			const mock = setup();
			component.onValueChange('42');
			expect(mock.state.value()).toBe(42);
		});

		it('should set null for empty string', () => {
			const mock = setup({}, 42);
			component.onValueChange('');
			expect(mock.state.value()).toBeNull();
		});

		it('should set null for NaN input', () => {
			const mock = setup();
			component.onValueChange('abc');
			expect(mock.state.value()).toBeNull();
		});

		it('should handle decimal numbers', () => {
			const mock = setup();
			component.onValueChange('3.14');
			expect(mock.state.value()).toBe(3.14);
		});
	});

	describe('onBlur', () => {
		it('should mark field as touched', () => {
			const mock = setup();
			component.onBlur();
			expect(mock.state.markAsTouched).toHaveBeenCalled();
		});
	});
});
