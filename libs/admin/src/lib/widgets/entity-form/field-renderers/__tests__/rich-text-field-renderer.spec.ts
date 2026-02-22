import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { RichTextFieldRenderer } from '../rich-text-field.component';

@Component({ selector: 'mcms-form-field', template: '' })
class MockFormField {}

const mockField = {
	name: 'content',
	type: 'richText' as const,
	label: 'Content',
	required: true,
};

describe('RichTextFieldRenderer', () => {
	let fixture: ComponentFixture<RichTextFieldRenderer>;
	let component: RichTextFieldRenderer;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [RichTextFieldRenderer],
		})
			.overrideComponent(RichTextFieldRenderer, {
				set: { imports: [MockFormField], template: '<div></div>' },
			})
			.compileComponents();

		fixture = TestBed.createComponent(RichTextFieldRenderer);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('field', mockField);
		fixture.componentRef.setInput('path', 'content');
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	describe('fieldId', () => {
		it('should generate id from path', () => {
			expect(component.fieldId()).toBe('field-content');
		});

		it('should replace dots with dashes', () => {
			fixture.componentRef.setInput('path', 'blocks.0.content');
			expect(component.fieldId()).toBe('field-blocks-0-content');
		});
	});

	describe('label', () => {
		it('should use field label', () => {
			expect(component.label()).toBe('Content');
		});

		it('should fallback to humanized field name', () => {
			fixture.componentRef.setInput('field', { ...mockField, label: undefined });
			expect(component.label()).toBe('Content');
		});
	});

	describe('required', () => {
		it('should read required from field', () => {
			expect(component.required()).toBe(true);
		});

		it('should default to false', () => {
			fixture.componentRef.setInput('field', { ...mockField, required: undefined });
			expect(component.required()).toBe(false);
		});
	});

	describe('isDisabled', () => {
		it('should be false for create mode', () => {
			fixture.componentRef.setInput('mode', 'create');
			expect(component.isDisabled()).toBe(false);
		});

		it('should be false for edit mode', () => {
			fixture.componentRef.setInput('mode', 'edit');
			expect(component.isDisabled()).toBe(false);
		});

		it('should be true for view mode', () => {
			fixture.componentRef.setInput('mode', 'view');
			expect(component.isDisabled()).toBe(true);
		});

		it('should be true when field is readOnly', () => {
			fixture.componentRef.setInput('field', {
				...mockField,
				admin: { readOnly: true },
			});
			expect(component.isDisabled()).toBe(true);
		});
	});

	describe('stringValue', () => {
		it('should return empty string when no formNode', () => {
			expect(component.stringValue()).toBe('');
		});
	});

	describe('touchedErrors', () => {
		it('should return empty array when no formNode', () => {
			expect(component.touchedErrors()).toEqual([]);
		});
	});

	describe('toolbar state', () => {
		it('should have all toolbar state signals initialized to false', () => {
			expect(component.isBold()).toBe(false);
			expect(component.isItalic()).toBe(false);
			expect(component.isUnderline()).toBe(false);
			expect(component.isStrike()).toBe(false);
			expect(component.isHeading1()).toBe(false);
			expect(component.isHeading2()).toBe(false);
			expect(component.isHeading3()).toBe(false);
			expect(component.isBulletList()).toBe(false);
			expect(component.isOrderedList()).toBe(false);
			expect(component.isBlockquote()).toBe(false);
			expect(component.isCodeBlock()).toBe(false);
		});
	});

	describe('editorReady', () => {
		it('should be false (editor not mounted in overridden template)', () => {
			expect(component.editorReady()).toBe(false);
		});
	});

	describe('toggle methods (no editor)', () => {
		it('toggleBold should not throw when editor is null', () => {
			expect(() => component.toggleBold()).not.toThrow();
		});

		it('toggleItalic should not throw when editor is null', () => {
			expect(() => component.toggleItalic()).not.toThrow();
		});

		it('toggleUnderline should not throw when editor is null', () => {
			expect(() => component.toggleUnderline()).not.toThrow();
		});

		it('toggleStrike should not throw when editor is null', () => {
			expect(() => component.toggleStrike()).not.toThrow();
		});

		it('toggleHeading should not throw when editor is null', () => {
			expect(() => component.toggleHeading(1)).not.toThrow();
			expect(() => component.toggleHeading(2)).not.toThrow();
			expect(() => component.toggleHeading(3)).not.toThrow();
		});

		it('toggleBulletList should not throw when editor is null', () => {
			expect(() => component.toggleBulletList()).not.toThrow();
		});

		it('toggleOrderedList should not throw when editor is null', () => {
			expect(() => component.toggleOrderedList()).not.toThrow();
		});

		it('toggleBlockquote should not throw when editor is null', () => {
			expect(() => component.toggleBlockquote()).not.toThrow();
		});

		it('toggleCodeBlock should not throw when editor is null', () => {
			expect(() => component.toggleCodeBlock()).not.toThrow();
		});

		it('insertHorizontalRule should not throw when editor is null', () => {
			expect(() => component.insertHorizontalRule()).not.toThrow();
		});
	});

	describe('onBlur', () => {
		it('should not throw when no formNode', () => {
			expect(() => component.onBlur()).not.toThrow();
		});
	});
});
