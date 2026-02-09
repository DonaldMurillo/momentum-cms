/**
 * Visual Block Editor - Shared Types
 *
 * Types, interfaces, and utilities for the WYSIWYG visual block editor.
 */

import type { WritableSignal } from '@angular/core';
import type { FieldType } from '@momentum-cms/core';

/** Shape of a block item in the stored data */
export interface BlockItem {
	blockType: string;
	[key: string]: unknown;
}

/** Field types that support inline editing in the visual editor */
export const INLINE_FIELD_TYPES: ReadonlySet<FieldType> = new Set(['text', 'textarea', 'richText']);

/** Check if a field type supports inline editing */
export function isInlineEditableField(fieldType: FieldType): boolean {
	return INLINE_FIELD_TYPES.has(fieldType);
}

/** State for the visual block editor */
export interface VisualEditorState {
	readonly selectedBlockIndex: WritableSignal<number | null>;
	readonly hoveredBlockIndex: WritableSignal<number | null>;
	readonly inserterOpen: WritableSignal<{ index: number } | null>;
	readonly collapsedBlocks: WritableSignal<Set<number>>;
}
