import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextFieldRenderer } from '../text-field.component';
import { createMockFieldNodeState, createMockField } from './test-helpers';

describe('TextFieldRenderer', () => {
	let fixture: ComponentFixture<TextFieldRenderer>;
	let component: TextFieldRenderer;

	function setup(
		fieldType = 'text',
		fieldOverrides: Record<string, unknown> = {},
		initialValue: unknown = '',
	): ReturnType<typeof createMockFieldNodeState> {
		const mock = createMockFieldNodeState(initialValue);
		TestBed.configureTestingModule({
			imports: [TextFieldRenderer],
		}).compileComponents();

		fixture = TestBed.createComponent(TextFieldRenderer);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('field', createMockField(fieldType, fieldOverrides));
		fixture.componentRef.setInput('path', 'testField');
		fixture.componentRef.setInput('formNode', mock.node);
		fixture.detectChanges();
		return mock;
	}

	it('should create the component', () => {
		setup();
		expect(component).toBeTruthy();
	});

	it('should compute fieldId from path', () => {
		setup('text', {}, '');
		expect(component.fieldId()).toBe('field-testField');
	});

	it('should replace dots with dashes in fieldId', () => {
		TestBed.configureTestingModule({ imports: [TextFieldRenderer] }).compileComponents();
		fixture = TestBed.createComponent(TextFieldRenderer);
		component = fixture.componentInstance;
		const mock = createMockFieldNodeState('');
		fixture.componentRef.setInput('field', createMockField('text'));
		fixture.componentRef.setInput('path', 'parent.child.field');
		fixture.componentRef.setInput('formNode', mock.node);
		fixture.detectChanges();
		expect(component.fieldId()).toBe('field-parent-child-field');
	});

	it('should use field label when provided', () => {
		setup('text', { label: 'My Label' });
		expect(component.label()).toBe('My Label');
	});

	it('should humanize field name when no label', () => {
		setup('text', { label: '', name: 'firstName' });
		expect(component.label()).toBeTruthy();
	});

	it('should return isTextarea true for textarea type', () => {
		setup('textarea');
		expect(component.isTextarea()).toBe(true);
	});

	it('should return isTextarea false for text type', () => {
		setup('text');
		expect(component.isTextarea()).toBe(false);
	});

	it('should return email inputType for email field', () => {
		setup('email');
		expect(component.inputType()).toBe('email');
	});

	it('should return text inputType for text field', () => {
		setup('text');
		expect(component.inputType()).toBe('text');
	});

	it('should read string value from state', () => {
		setup('text', {}, 'hello');
		expect(component.stringValue()).toBe('hello');
	});

	it('should convert null value to empty string', () => {
		setup('text', {}, null);
		expect(component.stringValue()).toBe('');
	});

	it('should convert undefined value to empty string', () => {
		setup('text', {}, undefined);
		expect(component.stringValue()).toBe('');
	});

	describe('maxLength and charCount', () => {
		it('should return maxLength for text field', () => {
			setup('text', { maxLength: 100 });
			expect(component.maxLength()).toBe(100);
		});

		it('should return maxLength for textarea field', () => {
			setup('textarea', { maxLength: 500 });
			expect(component.maxLength()).toBe(500);
		});

		it('should return undefined maxLength for non-text types', () => {
			setup('email');
			expect(component.maxLength()).toBeUndefined();
		});

		it('should show char count when maxLength exists', () => {
			setup('text', { maxLength: 100 }, 'hello');
			expect(component.showCharCount()).toBe(true);
			expect(component.charCount()).toBe(5);
		});

		it('should detect char count exceeded', () => {
			setup('text', { maxLength: 3 }, 'hello');
			expect(component.charCountExceeded()).toBe(true);
		});

		it('should not exceed when under limit', () => {
			setup('text', { maxLength: 100 }, 'hello');
			expect(component.charCountExceeded()).toBe(false);
		});
	});

	describe('disabled state', () => {
		it('should be disabled in view mode', () => {
			const mock = createMockFieldNodeState('');
			TestBed.configureTestingModule({ imports: [TextFieldRenderer] }).compileComponents();
			fixture = TestBed.createComponent(TextFieldRenderer);
			component = fixture.componentInstance;
			fixture.componentRef.setInput('field', createMockField('text'));
			fixture.componentRef.setInput('path', 'test');
			fixture.componentRef.setInput('formNode', mock.node);
			fixture.componentRef.setInput('mode', 'view');
			fixture.detectChanges();
			expect(component.isDisabled()).toBe(true);
		});

		it('should be disabled when readOnly', () => {
			setup('text', { admin: { readOnly: true } });
			expect(component.isDisabled()).toBe(true);
		});

		it('should not be disabled in create mode', () => {
			setup('text');
			expect(component.isDisabled()).toBe(false);
		});
	});

	describe('onValueChange', () => {
		it('should set value on state', () => {
			const mock = setup('text');
			component.onValueChange('new value');
			expect(mock.state.value()).toBe('new value');
		});
	});

	describe('onBlur', () => {
		it('should mark field as touched', () => {
			const mock = setup('text');
			component.onBlur();
			expect(mock.state.markAsTouched).toHaveBeenCalled();
		});
	});

	describe('touchedErrors', () => {
		it('should return empty array when not touched', () => {
			setup('text', {}, '');
			expect(component.touchedErrors()).toEqual([]);
		});

		it('should return errors when touched', () => {
			const mock = createMockFieldNodeState('', {
				touched: true,
				errors: [{ kind: 'required', message: 'Required' }],
			});
			TestBed.configureTestingModule({ imports: [TextFieldRenderer] }).compileComponents();
			fixture = TestBed.createComponent(TextFieldRenderer);
			component = fixture.componentInstance;
			fixture.componentRef.setInput('field', createMockField('text'));
			fixture.componentRef.setInput('path', 'test');
			fixture.componentRef.setInput('formNode', mock.node);
			fixture.detectChanges();
			expect(component.touchedErrors()).toEqual([{ kind: 'required', message: 'Required' }]);
		});
	});
});
