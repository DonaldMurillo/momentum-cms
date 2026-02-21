/**
 * Extended tests for RichTextFieldRenderer covering formNode integration paths.
 *
 * The base spec (rich-text-field-renderer.spec.ts) covers the no-formNode
 * code paths, toolbar signals, toggle methods with null editor, and basic
 * computed properties. This file targets the uncovered statements that
 * depend on a formNode being present: stringValue, touchedErrors, onBlur,
 * label humanization, disabled states, and admin field options.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, type WritableSignal } from '@angular/core';
import { RichTextFieldRenderer } from '../rich-text-field.component';
import { createMockFieldNodeState, createMockField } from './test-helpers';

@Component({ selector: 'mcms-form-field', template: '' })
class MockFormField {}

/**
 * Helper to set up the component with a formNode and optional field/mode overrides.
 * Overrides the template to avoid TipTap editor instantiation in unit tests.
 */
async function setup(options: {
	fieldType?: string;
	fieldOverrides?: Record<string, unknown>;
	initialValue?: unknown;
	formNodeOptions?: {
		errors?: ReadonlyArray<{ kind: string; message?: string }>;
		touched?: boolean;
		dirty?: boolean;
		invalid?: boolean;
	};
	mode?: 'create' | 'edit' | 'view';
	path?: string;
	skipFormNode?: boolean;
}): Promise<{
	fixture: ComponentFixture<RichTextFieldRenderer>;
	component: RichTextFieldRenderer;
	mock: ReturnType<typeof createMockFieldNodeState>;
}> {
	const mock = createMockFieldNodeState(options.initialValue ?? '', options.formNodeOptions);

	await TestBed.configureTestingModule({
		imports: [RichTextFieldRenderer],
	})
		.overrideComponent(RichTextFieldRenderer, {
			set: { imports: [MockFormField], template: '<div></div>' },
		})
		.compileComponents();

	const fixture = TestBed.createComponent(RichTextFieldRenderer);
	const component = fixture.componentInstance;

	const field = createMockField(options.fieldType ?? 'richText', options.fieldOverrides);
	fixture.componentRef.setInput('field', field);
	fixture.componentRef.setInput('path', options.path ?? 'content');

	if (!options.skipFormNode) {
		fixture.componentRef.setInput('formNode', mock.node);
	}

	if (options.mode) {
		fixture.componentRef.setInput('mode', options.mode);
	}

	fixture.detectChanges();

	return { fixture, component, mock };
}

describe('RichTextFieldRenderer (extended - formNode integration)', () => {
	// ---------------------------------------------------------------
	// stringValue with formNode
	// ---------------------------------------------------------------
	describe('stringValue with formNode', () => {
		it('should return string value from formNode when value is a string', async () => {
			const { component } = await setup({ initialValue: '<p>Hello world</p>' });
			expect(component.stringValue()).toBe('<p>Hello world</p>');
		});

		it('should return empty string when formNode value is null', async () => {
			const { component } = await setup({ initialValue: null });
			expect(component.stringValue()).toBe('');
		});

		it('should return empty string when formNode value is undefined', async () => {
			const { component } = await setup({ initialValue: undefined });
			expect(component.stringValue()).toBe('');
		});

		it('should convert number value to string', async () => {
			const { component } = await setup({ initialValue: 42 });
			expect(component.stringValue()).toBe('42');
		});

		it('should convert boolean value to string', async () => {
			const { component } = await setup({ initialValue: true });
			expect(component.stringValue()).toBe('true');
		});

		it('should convert object value to string representation', async () => {
			const { component } = await setup({ initialValue: { key: 'val' } });
			expect(component.stringValue()).toBe('[object Object]');
		});

		it('should return empty string for empty string value', async () => {
			const { component } = await setup({ initialValue: '' });
			expect(component.stringValue()).toBe('');
		});

		it('should reflect value changes on the state signal', async () => {
			const { component, mock } = await setup({ initialValue: '<p>Initial</p>' });
			expect(component.stringValue()).toBe('<p>Initial</p>');

			mock.state.value.set('<p>Updated</p>');
			expect(component.stringValue()).toBe('<p>Updated</p>');
		});
	});

	// ---------------------------------------------------------------
	// touchedErrors with formNode
	// ---------------------------------------------------------------
	describe('touchedErrors with formNode', () => {
		it('should return empty array when touched is false', async () => {
			const { component } = await setup({
				formNodeOptions: {
					touched: false,
					errors: [{ kind: 'required', message: 'Required' }],
				},
			});
			expect(component.touchedErrors()).toEqual([]);
		});

		it('should return mapped errors when touched is true', async () => {
			const { component } = await setup({
				formNodeOptions: {
					touched: true,
					errors: [{ kind: 'required', message: 'This field is required' }],
				},
			});
			expect(component.touchedErrors()).toEqual([
				{ kind: 'required', message: 'This field is required' },
			]);
		});

		it('should return multiple errors when touched', async () => {
			const { component } = await setup({
				formNodeOptions: {
					touched: true,
					errors: [
						{ kind: 'required', message: 'Required' },
						{ kind: 'minLength', message: 'Too short' },
					],
				},
			});
			expect(component.touchedErrors()).toHaveLength(2);
			expect(component.touchedErrors()).toEqual([
				{ kind: 'required', message: 'Required' },
				{ kind: 'minLength', message: 'Too short' },
			]);
		});

		it('should return empty array when touched but no errors', async () => {
			const { component } = await setup({
				formNodeOptions: {
					touched: true,
					errors: [],
				},
			});
			expect(component.touchedErrors()).toEqual([]);
		});

		it('should react to touched becoming true after initialization', async () => {
			const { component, mock } = await setup({
				formNodeOptions: {
					touched: false,
					errors: [{ kind: 'required', message: 'Required' }],
				},
			});
			expect(component.touchedErrors()).toEqual([]);

			(mock.state.touched as WritableSignal<boolean>).set(true);
			expect(component.touchedErrors()).toEqual([{ kind: 'required', message: 'Required' }]);
		});

		it('should handle errors with missing message property', async () => {
			const { component } = await setup({
				formNodeOptions: {
					touched: true,
					errors: [{ kind: 'custom' }],
				},
			});
			expect(component.touchedErrors()).toEqual([{ kind: 'custom', message: undefined }]);
		});
	});

	// ---------------------------------------------------------------
	// onBlur with formNode
	// ---------------------------------------------------------------
	describe('onBlur with formNode', () => {
		it('should call markAsTouched on the node state', async () => {
			const { component, mock } = await setup({});
			component.onBlur();
			expect(mock.state.markAsTouched).toHaveBeenCalledOnce();
		});

		it('should call markAsTouched each time onBlur is invoked', async () => {
			const { component, mock } = await setup({});
			component.onBlur();
			component.onBlur();
			expect(mock.state.markAsTouched).toHaveBeenCalledTimes(2);
		});
	});

	// ---------------------------------------------------------------
	// label computed property
	// ---------------------------------------------------------------
	describe('label', () => {
		it('should use explicit label from field definition', async () => {
			const { component } = await setup({ fieldOverrides: { label: 'Rich Content' } });
			expect(component.label()).toBe('Rich Content');
		});

		it('should humanize camelCase field name when label is absent', async () => {
			const { component } = await setup({
				fieldOverrides: { name: 'pageContent', label: undefined },
			});
			expect(component.label()).toBe('Page Content');
		});

		it('should humanize snake_case field name when label is absent', async () => {
			const { component } = await setup({
				fieldOverrides: { name: 'page_content', label: undefined },
			});
			expect(component.label()).toBe('Page Content');
		});

		it('should humanize kebab-case field name when label is absent', async () => {
			const { component } = await setup({
				fieldOverrides: { name: 'page-content', label: undefined },
			});
			expect(component.label()).toBe('Page Content');
		});

		it('should fallback to humanized name when label is empty string', async () => {
			const { component } = await setup({
				fieldOverrides: { name: 'bodyText', label: '' },
			});
			expect(component.label()).toBe('Body Text');
		});
	});

	// ---------------------------------------------------------------
	// isDisabled computed property
	// ---------------------------------------------------------------
	describe('isDisabled with formNode', () => {
		it('should be false in create mode without readOnly', async () => {
			const { component } = await setup({ mode: 'create' });
			expect(component.isDisabled()).toBe(false);
		});

		it('should be false in edit mode without readOnly', async () => {
			const { component } = await setup({ mode: 'edit' });
			expect(component.isDisabled()).toBe(false);
		});

		it('should be true in view mode', async () => {
			const { component } = await setup({ mode: 'view' });
			expect(component.isDisabled()).toBe(true);
		});

		it('should be true when admin.readOnly is true', async () => {
			const { component } = await setup({
				fieldOverrides: { admin: { readOnly: true } },
			});
			expect(component.isDisabled()).toBe(true);
		});

		it('should be false when admin.readOnly is false', async () => {
			const { component } = await setup({
				fieldOverrides: { admin: { readOnly: false } },
				mode: 'edit',
			});
			expect(component.isDisabled()).toBe(false);
		});

		it('should be true in view mode even when admin.readOnly is false', async () => {
			const { component } = await setup({
				fieldOverrides: { admin: { readOnly: false } },
				mode: 'view',
			});
			expect(component.isDisabled()).toBe(true);
		});
	});

	// ---------------------------------------------------------------
	// required computed property
	// ---------------------------------------------------------------
	describe('required with formNode', () => {
		it('should return true when field is required', async () => {
			const { component } = await setup({ fieldOverrides: { required: true } });
			expect(component.required()).toBe(true);
		});

		it('should return false when field is not required', async () => {
			const { component } = await setup({ fieldOverrides: { required: false } });
			expect(component.required()).toBe(false);
		});

		it('should default to false when required is undefined', async () => {
			const { component } = await setup({ fieldOverrides: { required: undefined } });
			expect(component.required()).toBe(false);
		});
	});

	// ---------------------------------------------------------------
	// fieldId with formNode
	// ---------------------------------------------------------------
	describe('fieldId with formNode', () => {
		it('should generate id from simple path', async () => {
			const { component } = await setup({ path: 'richContent' });
			expect(component.fieldId()).toBe('field-richContent');
		});

		it('should replace dots with dashes in nested paths', async () => {
			const { component } = await setup({ path: 'blocks.0.richContent' });
			expect(component.fieldId()).toBe('field-blocks-0-richContent');
		});

		it('should handle deeply nested paths', async () => {
			const { component } = await setup({ path: 'a.b.c.d.e' });
			expect(component.fieldId()).toBe('field-a-b-c-d-e');
		});
	});

	// ---------------------------------------------------------------
	// editorReady with formNode
	// ---------------------------------------------------------------
	describe('editorReady with formNode', () => {
		it('should remain false because editor is not mounted in overridden template', async () => {
			const { component } = await setup({});
			expect(component.editorReady()).toBe(false);
		});
	});

	// ---------------------------------------------------------------
	// toggle methods with formNode but no editor (still null)
	// ---------------------------------------------------------------
	describe('toggle methods with formNode (no editor)', () => {
		it('toggleBold should not throw', async () => {
			const { component } = await setup({});
			expect(() => component.toggleBold()).not.toThrow();
		});

		it('toggleItalic should not throw', async () => {
			const { component } = await setup({});
			expect(() => component.toggleItalic()).not.toThrow();
		});

		it('toggleUnderline should not throw', async () => {
			const { component } = await setup({});
			expect(() => component.toggleUnderline()).not.toThrow();
		});

		it('toggleStrike should not throw', async () => {
			const { component } = await setup({});
			expect(() => component.toggleStrike()).not.toThrow();
		});

		it('toggleHeading should not throw for all levels', async () => {
			const { component } = await setup({});
			expect(() => component.toggleHeading(1)).not.toThrow();
			expect(() => component.toggleHeading(2)).not.toThrow();
			expect(() => component.toggleHeading(3)).not.toThrow();
		});

		it('toggleBulletList should not throw', async () => {
			const { component } = await setup({});
			expect(() => component.toggleBulletList()).not.toThrow();
		});

		it('toggleOrderedList should not throw', async () => {
			const { component } = await setup({});
			expect(() => component.toggleOrderedList()).not.toThrow();
		});

		it('toggleBlockquote should not throw', async () => {
			const { component } = await setup({});
			expect(() => component.toggleBlockquote()).not.toThrow();
		});

		it('toggleCodeBlock should not throw', async () => {
			const { component } = await setup({});
			expect(() => component.toggleCodeBlock()).not.toThrow();
		});

		it('insertHorizontalRule should not throw', async () => {
			const { component } = await setup({});
			expect(() => component.insertHorizontalRule()).not.toThrow();
		});
	});

	// ---------------------------------------------------------------
	// Interaction between stringValue and formNode value changes
	// ---------------------------------------------------------------
	describe('stringValue reactivity', () => {
		it('should update stringValue when formNode value changes from string to null', async () => {
			const { component, mock } = await setup({ initialValue: '<p>Some content</p>' });
			expect(component.stringValue()).toBe('<p>Some content</p>');

			mock.state.value.set(null);
			expect(component.stringValue()).toBe('');
		});

		it('should update stringValue when formNode value changes from null to string', async () => {
			const { component, mock } = await setup({ initialValue: null });
			expect(component.stringValue()).toBe('');

			mock.state.value.set('<p>New content</p>');
			expect(component.stringValue()).toBe('<p>New content</p>');
		});

		it('should handle value transitioning from string to number', async () => {
			const { component, mock } = await setup({ initialValue: 'text' });
			expect(component.stringValue()).toBe('text');

			mock.state.value.set(123);
			expect(component.stringValue()).toBe('123');
		});
	});

	// ---------------------------------------------------------------
	// No formNode scenarios (ensure no regression)
	// ---------------------------------------------------------------
	describe('no formNode provided', () => {
		it('stringValue should return empty string', async () => {
			const { component } = await setup({ skipFormNode: true });
			expect(component.stringValue()).toBe('');
		});

		it('touchedErrors should return empty array', async () => {
			const { component } = await setup({ skipFormNode: true });
			expect(component.touchedErrors()).toEqual([]);
		});

		it('onBlur should not throw', async () => {
			const { component } = await setup({ skipFormNode: true });
			expect(() => component.onBlur()).not.toThrow();
		});
	});
});
