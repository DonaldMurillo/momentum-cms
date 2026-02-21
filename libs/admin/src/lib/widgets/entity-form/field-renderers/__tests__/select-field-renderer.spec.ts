import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SelectFieldRenderer } from '../select-field.component';
import { createMockFieldNodeState, createMockField } from './test-helpers';

describe('SelectFieldRenderer', () => {
	let fixture: ComponentFixture<SelectFieldRenderer>;
	let component: SelectFieldRenderer;

	function setup(
		fieldOverrides: Record<string, unknown> = {},
		initialValue: unknown = '',
	): ReturnType<typeof createMockFieldNodeState> {
		const mock = createMockFieldNodeState(initialValue);
		TestBed.configureTestingModule({
			imports: [SelectFieldRenderer],
		}).compileComponents();

		fixture = TestBed.createComponent(SelectFieldRenderer);
		component = fixture.componentInstance;
		const field = createMockField('select', {
			options: [
				{ label: 'Option A', value: 'a' },
				{ label: 'Option B', value: 'b' },
			],
			...fieldOverrides,
		});
		fixture.componentRef.setInput('field', field);
		fixture.componentRef.setInput('path', 'status');
		fixture.componentRef.setInput('formNode', mock.node);
		fixture.detectChanges();
		return mock;
	}

	it('should create the component', () => {
		setup();
		expect(component).toBeTruthy();
	});

	describe('selectOptions', () => {
		it('should map options to label/value pairs', () => {
			setup();
			expect(component.selectOptions()).toEqual([
				{ label: 'Option A', value: 'a' },
				{ label: 'Option B', value: 'b' },
			]);
		});

		it('should convert non-string values to strings', () => {
			setup({
				options: [
					{ label: 'One', value: 1 },
					{ label: 'Two', value: 2 },
				],
			});
			expect(component.selectOptions()).toEqual([
				{ label: 'One', value: '1' },
				{ label: 'Two', value: '2' },
			]);
		});

		it('should return empty array when no options', () => {
			setup({ options: undefined });
			expect(component.selectOptions()).toEqual([]);
		});
	});

	describe('placeholder', () => {
		it('should default to "Select..."', () => {
			setup();
			expect(component.placeholder()).toBe('Select...');
		});

		it('should use custom placeholder', () => {
			setup({ admin: { placeholder: 'Choose one' } });
			expect(component.placeholder()).toBe('Choose one');
		});
	});

	describe('stringValue', () => {
		it('should read value from state', () => {
			setup({}, 'a');
			expect(component.stringValue()).toBe('a');
		});

		it('should return empty string for null', () => {
			setup({}, null);
			expect(component.stringValue()).toBe('');
		});
	});

	describe('onValueChange', () => {
		it('should set value and mark as touched', () => {
			const mock = setup();
			component.onValueChange('b');
			expect(mock.state.value()).toBe('b');
			expect(mock.state.markAsTouched).toHaveBeenCalled();
		});

		it('should set null for empty string', () => {
			const mock = setup({}, 'a');
			component.onValueChange('');
			expect(mock.state.value()).toBeNull();
		});
	});
});
