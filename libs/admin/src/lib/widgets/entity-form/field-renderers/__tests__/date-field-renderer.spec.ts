import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DateFieldRenderer } from '../date-field.component';
import { createMockFieldNodeState, createMockField } from './test-helpers';

describe('DateFieldRenderer', () => {
	let fixture: ComponentFixture<DateFieldRenderer>;
	let component: DateFieldRenderer;

	function setup(
		fieldOverrides: Record<string, unknown> = {},
		initialValue: unknown = null,
	): ReturnType<typeof createMockFieldNodeState> {
		const mock = createMockFieldNodeState(initialValue);
		TestBed.configureTestingModule({
			imports: [DateFieldRenderer],
		}).compileComponents();

		fixture = TestBed.createComponent(DateFieldRenderer);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('field', createMockField('date', fieldOverrides));
		fixture.componentRef.setInput('path', 'publishedAt');
		fixture.componentRef.setInput('formNode', mock.node);
		fixture.detectChanges();
		return mock;
	}

	it('should create the component', () => {
		setup();
		expect(component).toBeTruthy();
	});

	describe('dateValue', () => {
		it('should return empty string for null', () => {
			setup({}, null);
			expect(component.dateValue()).toBe('');
		});

		it('should return empty string for empty string', () => {
			setup({}, '');
			expect(component.dateValue()).toBe('');
		});

		it('should format ISO date as YYYY-MM-DD', () => {
			setup({}, '2024-06-15T12:00:00.000Z');
			expect(component.dateValue()).toBe('2024-06-15');
		});

		it('should handle numeric timestamp', () => {
			const timestamp = new Date('2024-01-01').getTime();
			setup({}, timestamp);
			expect(component.dateValue()).toBe('2024-01-01');
		});

		it('should return empty string for invalid date', () => {
			setup({}, 'not-a-date');
			expect(component.dateValue()).toBe('');
		});
	});

	describe('inputType', () => {
		it('should return "date"', () => {
			setup();
			expect(component.inputType()).toBe('date');
		});
	});

	describe('onValueChange', () => {
		it('should set null for empty string', () => {
			const mock = setup({}, '2024-01-01');
			component.onValueChange('');
			expect(mock.state.value()).toBeNull();
		});

		it('should convert to ISO string', () => {
			const mock = setup();
			component.onValueChange('2024-06-15');
			const value = mock.state.value();
			expect(typeof value).toBe('string');
			expect(String(value)).toContain('2024-06-15');
		});
	});

	describe('onBlur', () => {
		it('should mark field as touched', () => {
			const mock = setup();
			component.onBlur();
			expect(mock.state.markAsTouched).toHaveBeenCalled();
		});
	});

	describe('disabled state', () => {
		it('should be disabled in view mode', () => {
			const mock = createMockFieldNodeState(null);
			TestBed.configureTestingModule({ imports: [DateFieldRenderer] }).compileComponents();
			fixture = TestBed.createComponent(DateFieldRenderer);
			component = fixture.componentInstance;
			fixture.componentRef.setInput('field', createMockField('date'));
			fixture.componentRef.setInput('path', 'test');
			fixture.componentRef.setInput('formNode', mock.node);
			fixture.componentRef.setInput('mode', 'view');
			fixture.detectChanges();
			expect(component.isDisabled()).toBe(true);
		});
	});
});
