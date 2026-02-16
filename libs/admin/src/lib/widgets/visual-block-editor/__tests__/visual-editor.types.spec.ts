import { describe, it, expect } from 'vitest';
import { isInlineEditableField, INLINE_FIELD_TYPES } from '../visual-editor.types';
import type { FieldType } from '@momentumcms/core';

describe('visual-editor.types', () => {
	describe('INLINE_FIELD_TYPES', () => {
		it('should include text, textarea, and richText', () => {
			expect(INLINE_FIELD_TYPES.has('text')).toBe(true);
			expect(INLINE_FIELD_TYPES.has('textarea')).toBe(true);
			expect(INLINE_FIELD_TYPES.has('richText')).toBe(true);
		});

		it('should NOT include non-inline types', () => {
			const nonInline: FieldType[] = [
				'number',
				'select',
				'checkbox',
				'date',
				'upload',
				'relationship',
				'group',
				'array',
				'blocks',
			];
			for (const ft of nonInline) {
				expect(INLINE_FIELD_TYPES.has(ft)).toBe(false);
			}
		});
	});

	describe('isInlineEditableField', () => {
		it('should return true for inline-editable types', () => {
			expect(isInlineEditableField('text')).toBe(true);
			expect(isInlineEditableField('textarea')).toBe(true);
			expect(isInlineEditableField('richText')).toBe(true);
		});

		it('should return false for non-inline types', () => {
			expect(isInlineEditableField('number')).toBe(false);
			expect(isInlineEditableField('select')).toBe(false);
			expect(isInlineEditableField('checkbox')).toBe(false);
			expect(isInlineEditableField('upload')).toBe(false);
			expect(isInlineEditableField('date')).toBe(false);
			expect(isInlineEditableField('relationship')).toBe(false);
			expect(isInlineEditableField('group')).toBe(false);
			expect(isInlineEditableField('array')).toBe(false);
			expect(isInlineEditableField('blocks')).toBe(false);
			expect(isInlineEditableField('email')).toBe(false);
			expect(isInlineEditableField('slug')).toBe(false);
			expect(isInlineEditableField('tabs')).toBe(false);
			expect(isInlineEditableField('collapsible')).toBe(false);
			expect(isInlineEditableField('row')).toBe(false);
		});
	});
});
