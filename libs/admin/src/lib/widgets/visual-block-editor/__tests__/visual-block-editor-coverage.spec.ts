/**
 * Additional coverage tests for VisualBlockEditorComponent.
 *
 * Targets remaining uncovered statements/branches:
 * - onDrop: CdkDragDrop handler delegation
 * - collapse management: shiftCollapsedUp/Down edge cases
 * - swapCollapsed: both blocks collapsed / both expanded
 * - keyboard: select tag, ArrowDown with no selection, unrelated keys
 * - removeBlock: when formNode state is null
 * - addBlock: when formNode state is null
 * - moveBlock: when formNode state is null
 * - normalizeBlockDefaults effect: triggers when blocks need defaults
 * - maxRows computed: for non-blocks field
 * - minRows computed: for non-blocks field
 * - label: humanized name fallback when no label
 */
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { VisualBlockEditorComponent } from '../visual-block-editor.component';
import { BlockWrapperComponent } from '../block-wrapper.component';
import { BlockInserterComponent } from '../block-inserter.component';
import type { BlockConfig, Field, BlocksField } from '@momentumcms/core';
import type { FieldNodeState } from '../../entity-form/entity-form.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockBlocksField(overrides: Partial<BlocksField> = {}): BlocksField {
	return {
		name: 'content',
		type: 'blocks',
		label: 'Page Content',
		blocks: [
			{
				slug: 'hero',
				labels: { singular: 'Hero', plural: 'Heroes' },
				fields: [
					{ name: 'heading', type: 'text', label: 'Heading' } as Field,
					{ name: 'subheading', type: 'textarea', label: 'Subheading' } as Field,
				],
			},
			{
				slug: 'textBlock',
				labels: { singular: 'Text Block', plural: 'Text Blocks' },
				fields: [{ name: 'body', type: 'textarea', label: 'Body Text' } as Field],
			},
		] as BlockConfig[],
		...overrides,
	} as BlocksField;
}

function createMockFormNode(initialBlocks: unknown[]): {
	node: unknown;
	state: FieldNodeState;
} {
	const valueSignal = signal<unknown>(initialBlocks);
	const state: FieldNodeState = {
		value: valueSignal,
		errors: signal([]),
		touched: signal(false),
		dirty: signal(false),
		invalid: signal(false),
		markAsTouched: (): void => {
			/* noop */
		},
		reset: (val?: unknown): void => {
			valueSignal.set(val ?? initialBlocks);
		},
	};

	const node = (): FieldNodeState => state;
	return { node, state };
}

function setupTestBed(): void {
	TestBed.configureTestingModule({});
	TestBed.overrideComponent(VisualBlockEditorComponent, {
		set: { template: '', imports: [] },
	});
	TestBed.overrideComponent(BlockWrapperComponent, {
		set: { template: '', imports: [] },
	});
	TestBed.overrideComponent(BlockInserterComponent, {
		set: { template: '', imports: [] },
	});
}

function createComponent(
	options: {
		field?: BlocksField;
		blocks?: unknown[];
		mode?: 'create' | 'edit' | 'view';
	} = {},
): { component: VisualBlockEditorComponent; state: FieldNodeState } {
	setupTestBed();

	const fixture = TestBed.createComponent(VisualBlockEditorComponent);
	const component = fixture.componentInstance;

	const field = options.field ?? createMockBlocksField();
	const blocks = options.blocks ?? [];
	const { node, state } = createMockFormNode(blocks);

	fixture.componentRef.setInput('field', field);
	fixture.componentRef.setInput('path', 'content');
	fixture.componentRef.setInput('formNode', node);
	fixture.componentRef.setInput('mode', options.mode ?? 'create');

	fixture.detectChanges();

	return { component, state };
}

function createKeyEvent(
	key: string,
	targetOverrides: Partial<{
		isContentEditable: boolean;
		tagName: string;
		closest: (sel: string) => HTMLElement | null;
	}> = {},
): KeyboardEvent {
	const tagName = targetOverrides.tagName ?? 'DIV';
	const el = document.createElement(tagName);
	if (targetOverrides.isContentEditable) {
		el.contentEditable = 'true';
		Object.defineProperty(el, 'isContentEditable', { value: true });
	}
	if (targetOverrides.closest) {
		el.closest = targetOverrides.closest;
	}
	const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
	Object.defineProperty(event, 'target', { value: el, writable: false });
	return event;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('VisualBlockEditorComponent (coverage)', () => {
	// -----------------------------------------------------------------------
	// onDrop handler
	// -----------------------------------------------------------------------
	describe('onDrop', () => {
		it('should delegate to moveBlock with previousIndex and currentIndex', () => {
			const { component, state } = createComponent({
				blocks: [
					{ blockType: 'hero', heading: 'First' },
					{ blockType: 'textBlock', body: 'Second' },
					{ blockType: 'hero', heading: 'Third' },
				],
			});

			const dropEvent = {
				previousIndex: 0,
				currentIndex: 2,
			};

			component.onDrop(dropEvent as never);

			const blocks = state.value() as Record<string, unknown>[];
			expect(blocks[0]['blockType']).toBe('textBlock');
			expect(blocks[2]['blockType']).toBe('hero');
			expect(component.editorState.selectedBlockIndex()).toBe(2);
		});

		it('should handle drop to same position', () => {
			const { component, state } = createComponent({
				blocks: [
					{ blockType: 'hero', heading: 'First' },
					{ blockType: 'textBlock', body: 'Second' },
				],
			});

			const dropEvent = { previousIndex: 1, currentIndex: 1 };
			component.onDrop(dropEvent as never);

			const blocks = state.value() as Record<string, unknown>[];
			expect(blocks[0]['blockType']).toBe('hero');
			expect(blocks[1]['blockType']).toBe('textBlock');
		});
	});

	// -----------------------------------------------------------------------
	// Collapse management - both blocks collapsed during swap
	// -----------------------------------------------------------------------
	describe('swapCollapsed - both collapsed', () => {
		it('should swap collapsed state when both blocks are collapsed', () => {
			const { component } = createComponent({
				blocks: [
					{ blockType: 'hero', heading: 'A' },
					{ blockType: 'textBlock', body: 'B' },
				],
			});

			component.toggleBlockCollapse(0);
			component.toggleBlockCollapse(1);
			expect(component.isBlockCollapsed(0)).toBe(true);
			expect(component.isBlockCollapsed(1)).toBe(true);

			component.moveBlock(0, 1);

			// After swap, both should still be collapsed (they just swapped)
			expect(component.isBlockCollapsed(0)).toBe(true);
			expect(component.isBlockCollapsed(1)).toBe(true);
		});

		it('should swap correctly when neither block is collapsed', () => {
			const { component } = createComponent({
				blocks: [
					{ blockType: 'hero', heading: 'A' },
					{ blockType: 'textBlock', body: 'B' },
				],
			});

			// Neither collapsed
			expect(component.isBlockCollapsed(0)).toBe(false);
			expect(component.isBlockCollapsed(1)).toBe(false);

			component.moveBlock(0, 1);

			expect(component.isBlockCollapsed(0)).toBe(false);
			expect(component.isBlockCollapsed(1)).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// shiftCollapsedUp - edge cases
	// -----------------------------------------------------------------------
	describe('shiftCollapsedUp - when collapsed block is at the insert point', () => {
		it('should shift collapsed block at the exact insert index', () => {
			const { component } = createComponent({
				blocks: [
					{ blockType: 'hero', heading: 'A' },
					{ blockType: 'textBlock', body: 'B' },
				],
			});

			component.toggleBlockCollapse(1);
			expect(component.isBlockCollapsed(1)).toBe(true);

			// Insert at index 1 -> collapsed block at 1 should move to 2
			component.addBlock('hero', 1);

			expect(component.isBlockCollapsed(1)).toBe(false);
			expect(component.isBlockCollapsed(2)).toBe(true);
		});
	});

	// -----------------------------------------------------------------------
	// shiftCollapsedDown - edge cases
	// -----------------------------------------------------------------------
	describe('shiftCollapsedDown - remove block before collapsed', () => {
		it('should keep collapsed block below the removed index unchanged', () => {
			const { component } = createComponent({
				blocks: [
					{ blockType: 'hero', heading: 'A' },
					{ blockType: 'textBlock', body: 'B' },
					{ blockType: 'hero', heading: 'C' },
				],
			});

			// Collapse block 0
			component.toggleBlockCollapse(0);
			expect(component.isBlockCollapsed(0)).toBe(true);

			// Remove block 2 (after the collapsed block)
			component.removeBlock(2);

			// Block 0 should still be collapsed
			expect(component.isBlockCollapsed(0)).toBe(true);
		});
	});

	// -----------------------------------------------------------------------
	// Keyboard navigation - select tag
	// -----------------------------------------------------------------------
	describe('keyboard - select element', () => {
		it('should not handle keyboard when target is a select element', () => {
			const { component } = createComponent({
				blocks: [
					{ blockType: 'hero', heading: 'A' },
					{ blockType: 'textBlock', body: 'B' },
				],
			});

			component.editorState.selectedBlockIndex.set(1);
			component.onKeydown(createKeyEvent('ArrowUp', { tagName: 'SELECT' }));
			expect(component.editorState.selectedBlockIndex()).toBe(1);
		});
	});

	describe('keyboard - ArrowDown with no selection', () => {
		it('should do nothing when no block is selected', () => {
			const { component } = createComponent({
				blocks: [{ blockType: 'hero', heading: 'A' }],
			});

			component.onKeydown(createKeyEvent('ArrowDown'));
			expect(component.editorState.selectedBlockIndex()).toBeNull();
		});
	});

	describe('keyboard - unrelated keys', () => {
		it('should not change state for unrelated keys', () => {
			const { component } = createComponent({
				blocks: [{ blockType: 'hero', heading: 'A' }],
			});

			component.editorState.selectedBlockIndex.set(0);
			component.onKeydown(createKeyEvent('Tab'));
			expect(component.editorState.selectedBlockIndex()).toBe(0);
		});

		it('should not change state for Enter key', () => {
			const { component } = createComponent({
				blocks: [{ blockType: 'hero', heading: 'A' }],
			});

			component.editorState.selectedBlockIndex.set(0);
			component.onKeydown(createKeyEvent('Enter'));
			expect(component.editorState.selectedBlockIndex()).toBe(0);
		});
	});

	// -----------------------------------------------------------------------
	// removeBlock / addBlock / moveBlock when formNode state is null
	// -----------------------------------------------------------------------
	describe('operations with null formNode', () => {
		it('removeBlock should not throw when formNode is null', () => {
			setupTestBed();
			const fixture = TestBed.createComponent(VisualBlockEditorComponent);
			const comp = fixture.componentInstance;
			fixture.componentRef.setInput('field', createMockBlocksField());
			fixture.componentRef.setInput('path', 'content');
			// No formNode set
			fixture.detectChanges();

			expect(() => comp.removeBlock(0)).not.toThrow();
		});

		it('addBlock should not throw when formNode is null', () => {
			setupTestBed();
			const fixture = TestBed.createComponent(VisualBlockEditorComponent);
			const comp = fixture.componentInstance;
			fixture.componentRef.setInput('field', createMockBlocksField());
			fixture.componentRef.setInput('path', 'content');
			fixture.detectChanges();

			expect(() => comp.addBlock('hero', 0)).not.toThrow();
		});

		it('moveBlock should not throw when formNode is null', () => {
			setupTestBed();
			const fixture = TestBed.createComponent(VisualBlockEditorComponent);
			const comp = fixture.componentInstance;
			fixture.componentRef.setInput('field', createMockBlocksField());
			fixture.componentRef.setInput('path', 'content');
			fixture.detectChanges();

			expect(() => comp.moveBlock(0, 1)).not.toThrow();
		});
	});

	// -----------------------------------------------------------------------
	// label - humanized name fallback
	// -----------------------------------------------------------------------
	describe('label - humanized name fallback', () => {
		it('should humanize field name when no label is provided', () => {
			const field = createMockBlocksField({ label: undefined, name: 'pageContent' });
			const { component } = createComponent({ field });
			// humanizeFieldName('pageContent') should produce a human-readable string
			expect(component.label()).toBeTruthy();
			expect(component.label()).not.toBe('');
		});

		it('should use empty string label (truthy check)', () => {
			const field = createMockBlocksField({ label: '' });
			const { component } = createComponent({ field });
			// '' is falsy, so humanizeFieldName fallback kicks in
			expect(component.label()).toBeTruthy();
		});
	});

	// -----------------------------------------------------------------------
	// minRows / maxRows for non-blocks field
	// -----------------------------------------------------------------------
	describe('minRows / maxRows for non-blocks field', () => {
		it('should return 0 for minRows on non-blocks field', () => {
			const textField = { name: 'title', type: 'text' } as Field;
			setupTestBed();
			const fixture = TestBed.createComponent(VisualBlockEditorComponent);
			fixture.componentRef.setInput('field', textField);
			fixture.componentRef.setInput('path', 'title');
			fixture.detectChanges();

			expect(fixture.componentInstance.minRows()).toBe(0);
		});

		it('should return undefined for maxRows on non-blocks field', () => {
			const textField = { name: 'title', type: 'text' } as Field;
			setupTestBed();
			const fixture = TestBed.createComponent(VisualBlockEditorComponent);
			fixture.componentRef.setInput('field', textField);
			fixture.componentRef.setInput('path', 'title');
			fixture.detectChanges();

			expect(fixture.componentInstance.maxRows()).toBeUndefined();
		});
	});

	// -----------------------------------------------------------------------
	// blocks computed - state value is not an array
	// -----------------------------------------------------------------------
	describe('blocks computed - non-array state', () => {
		it('should return empty array when state value is a string', () => {
			const valueSignal = signal<unknown>('not an array');
			const state: FieldNodeState = {
				value: valueSignal,
				errors: signal([]),
				touched: signal(false),
				dirty: signal(false),
				invalid: signal(false),
				markAsTouched: (): void => {
					/* noop */
				},
				reset: (): void => {
					/* noop */
				},
			};
			const node = (): FieldNodeState => state;

			setupTestBed();
			const fixture = TestBed.createComponent(VisualBlockEditorComponent);
			fixture.componentRef.setInput('field', createMockBlocksField());
			fixture.componentRef.setInput('path', 'content');
			fixture.componentRef.setInput('formNode', node);
			fixture.detectChanges();

			expect(fixture.componentInstance.blocks()).toEqual([]);
		});

		it('should return empty array when state value is null', () => {
			const valueSignal = signal<unknown>(null);
			const state: FieldNodeState = {
				value: valueSignal,
				errors: signal([]),
				touched: signal(false),
				dirty: signal(false),
				invalid: signal(false),
				markAsTouched: (): void => {
					/* noop */
				},
				reset: (): void => {
					/* noop */
				},
			};
			const node = (): FieldNodeState => state;

			setupTestBed();
			const fixture = TestBed.createComponent(VisualBlockEditorComponent);
			fixture.componentRef.setInput('field', createMockBlocksField());
			fixture.componentRef.setInput('path', 'content');
			fixture.componentRef.setInput('formNode', node);
			fixture.detectChanges();

			expect(fixture.componentInstance.blocks()).toEqual([]);
		});
	});

	// -----------------------------------------------------------------------
	// removeBlock - selection adjustment when removing before selected
	// -----------------------------------------------------------------------
	describe('removeBlock - selection adjustment edge cases', () => {
		it('should not adjust selection when removing block after selected', () => {
			const { component } = createComponent({
				blocks: [
					{ blockType: 'hero', heading: 'A' },
					{ blockType: 'textBlock', body: 'B' },
					{ blockType: 'hero', heading: 'C' },
				],
			});

			component.editorState.selectedBlockIndex.set(0);
			component.removeBlock(2);

			expect(component.editorState.selectedBlockIndex()).toBe(0);
		});

		it('should clamp selection to last block when removing selected at end', () => {
			const { component } = createComponent({
				blocks: [
					{ blockType: 'hero', heading: 'A' },
					{ blockType: 'textBlock', body: 'B' },
				],
			});

			component.editorState.selectedBlockIndex.set(1);
			component.removeBlock(1);

			// Should clamp to 0 (last remaining block)
			expect(component.editorState.selectedBlockIndex()).toBe(0);
		});
	});

	// -----------------------------------------------------------------------
	// getBlockLabel - block without labels property
	// -----------------------------------------------------------------------
	describe('getBlockLabel - block without labels.singular', () => {
		it('should fall back to slug when labels is undefined', () => {
			const field = {
				name: 'content',
				type: 'blocks',
				label: 'Content',
				blocks: [{ slug: 'custom', fields: [] } as BlockConfig],
			} as BlocksField;

			const { component } = createComponent({ field });
			// labels is undefined, so || fallback to blockType slug
			expect(component.getBlockLabel('custom')).toBe('custom');
		});
	});
});
