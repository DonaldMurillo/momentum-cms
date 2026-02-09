/**
 * Unit tests for VisualBlockEditorComponent logic.
 *
 * Tests the core orchestration logic: block CRUD, selection state,
 * keyboard navigation, and block label/config lookup.
 *
 * Uses TestBed with overrideComponent to strip template dependencies,
 * since the full component tree has deep Angular CDK/UI dependencies.
 */
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { VisualBlockEditorComponent } from '../visual-block-editor.component';
import { BlockWrapperComponent } from '../block-wrapper.component';
import { BlockInserterComponent } from '../block-inserter.component';
import type { BlockConfig, Field, BlocksField } from '@momentum-cms/core';
import type { FieldNodeState } from '../../entity-form/entity-form.types';

/** Create a mock BlocksField */
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
					{ name: 'ctaText', type: 'text', label: 'CTA Button Text' } as Field,
					{ name: 'ctaLink', type: 'text', label: 'CTA Button Link' } as Field,
				],
			},
			{
				slug: 'textBlock',
				labels: { singular: 'Text Block', plural: 'Text Blocks' },
				fields: [
					{ name: 'heading', type: 'text', label: 'Section Heading' } as Field,
					{ name: 'body', type: 'textarea', label: 'Body Text' } as Field,
				],
			},
			{
				slug: 'feature',
				labels: { singular: 'Feature', plural: 'Features' },
				fields: [
					{ name: 'title', type: 'text', label: 'Feature Title' } as Field,
					{ name: 'description', type: 'textarea', label: 'Feature Description' } as Field,
					{ name: 'icon', type: 'text', label: 'Icon Name' } as Field,
				],
			},
		] as BlockConfig[],
		...overrides,
	} as BlocksField;
}

/** Create a mock formNode that provides FieldNodeState */
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
			/* noop for test stub */
		},
		reset: (val?: unknown): void => {
			valueSignal.set(val ?? initialBlocks);
		},
	};

	// formNode is a function that returns the state (matches getFieldNodeState pattern)
	const node = (): FieldNodeState => state;

	return { node, state };
}

function createComponent(
	options: {
		field?: BlocksField;
		blocks?: unknown[];
		mode?: 'create' | 'edit' | 'view';
	} = {},
): { component: VisualBlockEditorComponent; state: FieldNodeState } {
	TestBed.configureTestingModule({});

	// Override to strip template/imports to avoid resolving deep component tree
	TestBed.overrideComponent(VisualBlockEditorComponent, {
		set: { template: '', imports: [] },
	});
	TestBed.overrideComponent(BlockWrapperComponent, {
		set: { template: '', imports: [], providers: [] },
	});
	TestBed.overrideComponent(BlockInserterComponent, {
		set: { template: '', imports: [], providers: [] },
	});

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

describe('VisualBlockEditorComponent', () => {
	describe('block definitions', () => {
		it('should extract block definitions from a blocks field', () => {
			const { component } = createComponent();
			expect(component.blockDefinitions()).toHaveLength(3);
			expect(component.blockDefinitions()[0].slug).toBe('hero');
			expect(component.blockDefinitions()[1].slug).toBe('textBlock');
			expect(component.blockDefinitions()[2].slug).toBe('feature');
		});

		it('should return empty array for non-blocks field type', () => {
			const textField = { name: 'title', type: 'text' } as Field;
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
			const fixture = TestBed.createComponent(VisualBlockEditorComponent);
			fixture.componentRef.setInput('field', textField);
			fixture.componentRef.setInput('path', 'title');
			fixture.detectChanges();

			expect(fixture.componentInstance.blockDefinitions()).toHaveLength(0);
		});
	});

	describe('computed label and description', () => {
		it('should use the field label when provided', () => {
			const { component } = createComponent();
			expect(component.label()).toBe('Page Content');
		});

		it('should use description when provided', () => {
			const field = createMockBlocksField({ description: 'Build your page' });
			const { component } = createComponent({ field });
			expect(component.description()).toBe('Build your page');
		});

		it('should return empty description when not provided', () => {
			const { component } = createComponent();
			expect(component.description()).toBe('');
		});
	});

	describe('blocks computed', () => {
		it('should return empty array when no form node', () => {
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
			const fixture = TestBed.createComponent(VisualBlockEditorComponent);
			fixture.componentRef.setInput('field', createMockBlocksField());
			fixture.componentRef.setInput('path', 'content');
			fixture.detectChanges();

			expect(fixture.componentInstance.blocks()).toEqual([]);
		});

		it('should extract BlockItem array from form node state', () => {
			const blocks = [
				{ blockType: 'hero', heading: 'Welcome' },
				{ blockType: 'textBlock', body: 'Hello' },
			];
			const { component } = createComponent({ blocks });
			expect(component.blocks()).toHaveLength(2);
			expect(component.blocks()[0].blockType).toBe('hero');
			expect(component.blocks()[1].blockType).toBe('textBlock');
		});

		it('should filter out non-block items', () => {
			const blocks = [
				{ blockType: 'hero', heading: 'Valid' },
				'not a block',
				42,
				null,
				{ noBlockType: true },
			];
			const { component } = createComponent({ blocks });
			expect(component.blocks()).toHaveLength(1);
			expect(component.blocks()[0].blockType).toBe('hero');
		});
	});

	describe('isDisabled', () => {
		it('should return true in view mode', () => {
			const { component } = createComponent({ mode: 'view' });
			expect(component.isDisabled()).toBe(true);
		});

		it('should return false in create mode', () => {
			const { component } = createComponent({ mode: 'create' });
			expect(component.isDisabled()).toBe(false);
		});

		it('should return false in edit mode', () => {
			const { component } = createComponent({ mode: 'edit' });
			expect(component.isDisabled()).toBe(false);
		});
	});

	describe('addBlock', () => {
		it('should add a block at the specified index', () => {
			const { component, state } = createComponent({
				blocks: [{ blockType: 'hero', heading: 'Existing' }],
			});

			component.addBlock('textBlock', 0);

			const blocks = state.value() as Record<string, unknown>[];
			expect(blocks).toHaveLength(2);
			expect(blocks[0]['blockType']).toBe('textBlock');
			expect(blocks[1]['blockType']).toBe('hero');
		});

		it('should populate default values from field definitions', () => {
			const { component, state } = createComponent({ blocks: [] });

			component.addBlock('hero', 0);

			const blocks = state.value() as Record<string, unknown>[];
			expect(blocks).toHaveLength(1);
			expect(blocks[0]['blockType']).toBe('hero');
			expect(blocks[0]['heading']).toBe('');
			expect(blocks[0]['subheading']).toBe('');
			expect(blocks[0]['ctaText']).toBe('');
			expect(blocks[0]['ctaLink']).toBe('');
		});

		it('should select the newly added block', () => {
			const { component } = createComponent({ blocks: [] });
			component.addBlock('hero', 0);
			expect(component.editorState.selectedBlockIndex()).toBe(0);
		});

		it('should not add a block for unknown block type', () => {
			const { component, state } = createComponent({ blocks: [] });
			component.addBlock('nonExistentBlock', 0);
			expect((state.value() as unknown[]).length).toBe(0);
			expect(component.editorState.selectedBlockIndex()).toBeNull();
		});

		it('should allow adding beyond maxRows (UI enforces limit via hidden inserters)', () => {
			const field = createMockBlocksField({ maxRows: 1 });
			const { component, state } = createComponent({
				field,
				blocks: [{ blockType: 'hero', heading: 'Existing' }],
			});

			// addBlock does not enforce maxRows — the UI prevents adding by hiding inserters.
			// This test documents that the method itself does not guard against maxRows.
			component.addBlock('textBlock', 1);
			const blocks = state.value() as Record<string, unknown>[];
			expect(blocks).toHaveLength(2);
		});

		it('should insert at end when atIndex equals array length', () => {
			const { component, state } = createComponent({
				blocks: [{ blockType: 'hero', heading: 'First' }],
			});

			component.addBlock('textBlock', 1);

			const blocks = state.value() as Record<string, unknown>[];
			expect(blocks).toHaveLength(2);
			expect(blocks[0]['blockType']).toBe('hero');
			expect(blocks[1]['blockType']).toBe('textBlock');
		});
	});

	describe('removeBlock', () => {
		it('should remove the block at the specified index', () => {
			const { component, state } = createComponent({
				blocks: [
					{ blockType: 'hero', heading: 'First' },
					{ blockType: 'textBlock', body: 'Second' },
				],
			});

			component.removeBlock(0);

			const blocks = state.value() as Record<string, unknown>[];
			expect(blocks).toHaveLength(1);
			expect(blocks[0]['blockType']).toBe('textBlock');
		});

		it('should adjust selection when removing the selected block', () => {
			const { component } = createComponent({
				blocks: [
					{ blockType: 'hero', heading: 'A' },
					{ blockType: 'textBlock', body: 'B' },
				],
			});

			component.editorState.selectedBlockIndex.set(0);
			component.removeBlock(0);

			expect(component.editorState.selectedBlockIndex()).toBe(0);
		});

		it('should set selection to null when removing the last block', () => {
			const { component } = createComponent({
				blocks: [{ blockType: 'hero', heading: 'Only' }],
			});

			component.editorState.selectedBlockIndex.set(0);
			component.removeBlock(0);

			expect(component.editorState.selectedBlockIndex()).toBeNull();
		});

		it('should adjust selection when removing a block before the selected one', () => {
			const { component } = createComponent({
				blocks: [
					{ blockType: 'hero', heading: 'A' },
					{ blockType: 'textBlock', body: 'B' },
					{ blockType: 'hero', heading: 'C' },
				],
			});

			component.editorState.selectedBlockIndex.set(2);
			component.removeBlock(0);

			expect(component.editorState.selectedBlockIndex()).toBe(1);
		});
	});

	describe('moveBlock', () => {
		it('should move a block from one position to another', () => {
			const { component, state } = createComponent({
				blocks: [
					{ blockType: 'hero', heading: 'First' },
					{ blockType: 'textBlock', body: 'Second' },
				],
			});

			component.moveBlock(0, 1);

			const blocks = state.value() as Record<string, unknown>[];
			expect(blocks[0]['blockType']).toBe('textBlock');
			expect(blocks[1]['blockType']).toBe('hero');
		});

		it('should update selection to the new position', () => {
			const { component } = createComponent({
				blocks: [
					{ blockType: 'hero', heading: 'A' },
					{ blockType: 'textBlock', body: 'B' },
				],
			});

			component.moveBlock(0, 1);
			expect(component.editorState.selectedBlockIndex()).toBe(1);
		});

		it('should not move to negative index', () => {
			const { component, state } = createComponent({
				blocks: [{ blockType: 'hero', heading: 'Only' }],
			});

			component.moveBlock(0, -1);

			const blocks = state.value() as Record<string, unknown>[];
			expect(blocks).toHaveLength(1);
			expect(blocks[0]['blockType']).toBe('hero');
			// Selection should not be corrupted to -1
			expect(component.editorState.selectedBlockIndex()).toBeNull();
		});

		it('should not move beyond array length', () => {
			const { state, component } = createComponent({
				blocks: [{ blockType: 'hero', heading: 'Only' }],
			});

			component.moveBlock(0, 1);

			const blocks = state.value() as Record<string, unknown>[];
			expect(blocks).toHaveLength(1);
			// Selection should not be corrupted to out-of-bounds index
			expect(component.editorState.selectedBlockIndex()).toBeNull();
		});
	});

	describe('selectBlock', () => {
		it('should set the selected block index', () => {
			const { component } = createComponent();
			component.selectBlock(2);
			expect(component.editorState.selectedBlockIndex()).toBe(2);
		});
	});

	describe('getBlockLabel', () => {
		it('should return label from block definition', () => {
			const { component } = createComponent();
			expect(component.getBlockLabel('hero')).toBe('Hero');
			expect(component.getBlockLabel('textBlock')).toBe('Text Block');
		});

		it('should fall back to slug for unknown block type', () => {
			const { component } = createComponent();
			expect(component.getBlockLabel('unknown')).toBe('unknown');
		});
	});

	describe('getBlockConfig', () => {
		it('should return config for known block type', () => {
			const { component } = createComponent();
			const config = component.getBlockConfig('hero');
			expect(config.slug).toBe('hero');
			expect(config.fields).toHaveLength(4);
		});

		it('should return empty config for unknown block type', () => {
			const { component } = createComponent();
			const config = component.getBlockConfig('nonexistent');
			expect(config.slug).toBe('unknown');
			expect(config.fields).toHaveLength(0);
		});
	});

	describe('canRemoveBlock', () => {
		it('should return true when blocks exceed minRows', () => {
			const field = createMockBlocksField({ minRows: 1 });
			const { component } = createComponent({
				field,
				blocks: [
					{ blockType: 'hero', heading: 'A' },
					{ blockType: 'hero', heading: 'B' },
				],
			});
			expect(component.canRemoveBlock()).toBe(true);
		});

		it('should return false when blocks equal minRows', () => {
			const field = createMockBlocksField({ minRows: 2 });
			const { component } = createComponent({
				field,
				blocks: [
					{ blockType: 'hero', heading: 'A' },
					{ blockType: 'hero', heading: 'B' },
				],
			});
			expect(component.canRemoveBlock()).toBe(false);
		});

		it('should return false in view mode', () => {
			const { component } = createComponent({
				mode: 'view',
				blocks: [
					{ blockType: 'hero', heading: 'A' },
					{ blockType: 'hero', heading: 'B' },
				],
			});
			expect(component.canRemoveBlock()).toBe(false);
		});
	});

	describe('keyboard navigation (onKeydown)', () => {
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
				// Force isContentEditable to return true (jsdom doesn't always reflect it)
				Object.defineProperty(el, 'isContentEditable', { value: true });
			}
			if (targetOverrides.closest) {
				el.closest = targetOverrides.closest;
			}
			const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
			Object.defineProperty(event, 'target', { value: el, writable: false });
			return event;
		}

		it('should move selection up on ArrowUp', () => {
			const { component } = createComponent({
				blocks: [
					{ blockType: 'hero', heading: 'A' },
					{ blockType: 'textBlock', body: 'B' },
				],
			});

			component.editorState.selectedBlockIndex.set(1);
			component.onKeydown(createKeyEvent('ArrowUp'));
			expect(component.editorState.selectedBlockIndex()).toBe(0);
		});

		it('should not move above index 0', () => {
			const { component } = createComponent({
				blocks: [{ blockType: 'hero', heading: 'A' }],
			});

			component.editorState.selectedBlockIndex.set(0);
			component.onKeydown(createKeyEvent('ArrowUp'));
			expect(component.editorState.selectedBlockIndex()).toBe(0);
		});

		it('should move selection down on ArrowDown', () => {
			const { component } = createComponent({
				blocks: [
					{ blockType: 'hero', heading: 'A' },
					{ blockType: 'textBlock', body: 'B' },
				],
			});

			component.editorState.selectedBlockIndex.set(0);
			component.onKeydown(createKeyEvent('ArrowDown'));
			expect(component.editorState.selectedBlockIndex()).toBe(1);
		});

		it('should not move below last index', () => {
			const { component } = createComponent({
				blocks: [{ blockType: 'hero', heading: 'A' }],
			});

			component.editorState.selectedBlockIndex.set(0);
			component.onKeydown(createKeyEvent('ArrowDown'));
			expect(component.editorState.selectedBlockIndex()).toBe(0);
		});

		it('should deselect on Escape', () => {
			const { component } = createComponent({
				blocks: [{ blockType: 'hero', heading: 'A' }],
			});

			component.editorState.selectedBlockIndex.set(0);
			component.onKeydown(createKeyEvent('Escape'));
			expect(component.editorState.selectedBlockIndex()).toBeNull();
		});

		it('should not handle keyboard when target is contenteditable', () => {
			const { component } = createComponent({
				blocks: [
					{ blockType: 'hero', heading: 'A' },
					{ blockType: 'textBlock', body: 'B' },
				],
			});

			component.editorState.selectedBlockIndex.set(1);
			component.onKeydown(createKeyEvent('ArrowUp', { isContentEditable: true }));
			expect(component.editorState.selectedBlockIndex()).toBe(1);
		});

		it('should not handle keyboard when target is a form input', () => {
			const { component } = createComponent({
				blocks: [
					{ blockType: 'hero', heading: 'A' },
					{ blockType: 'textBlock', body: 'B' },
				],
			});

			component.editorState.selectedBlockIndex.set(1);
			component.onKeydown(createKeyEvent('ArrowUp', { tagName: 'INPUT' }));
			expect(component.editorState.selectedBlockIndex()).toBe(1);
		});

		it('should not handle keyboard when target is a textarea', () => {
			const { component } = createComponent({
				blocks: [
					{ blockType: 'hero', heading: 'A' },
					{ blockType: 'textBlock', body: 'B' },
				],
			});

			component.editorState.selectedBlockIndex.set(1);
			component.onKeydown(createKeyEvent('ArrowUp', { tagName: 'TEXTAREA' }));
			expect(component.editorState.selectedBlockIndex()).toBe(1);
		});

		it('should not handle keyboard when target is inside a rich text editor', () => {
			const { component } = createComponent({
				blocks: [
					{ blockType: 'hero', heading: 'A' },
					{ blockType: 'textBlock', body: 'B' },
				],
			});

			component.editorState.selectedBlockIndex.set(1);
			const mockElement = document.createElement('div');
			component.onKeydown(createKeyEvent('ArrowUp', { closest: () => mockElement }));
			expect(component.editorState.selectedBlockIndex()).toBe(1);
		});

		it('should do nothing for ArrowUp when no selection', () => {
			const { component } = createComponent({
				blocks: [{ blockType: 'hero', heading: 'A' }],
			});

			component.onKeydown(createKeyEvent('ArrowUp'));
			expect(component.editorState.selectedBlockIndex()).toBeNull();
		});

		it('should remove selected block on Delete key', () => {
			const { component, state } = createComponent({
				blocks: [
					{ blockType: 'hero', heading: 'A' },
					{ blockType: 'textBlock', body: 'B' },
				],
			});

			component.editorState.selectedBlockIndex.set(0);
			component.onKeydown(createKeyEvent('Delete'));

			const blocks = state.value() as Record<string, unknown>[];
			expect(blocks).toHaveLength(1);
			expect(blocks[0]['blockType']).toBe('textBlock');
		});

		it('should remove selected block on Backspace key', () => {
			const { component, state } = createComponent({
				blocks: [
					{ blockType: 'hero', heading: 'A' },
					{ blockType: 'textBlock', body: 'B' },
				],
			});

			component.editorState.selectedBlockIndex.set(1);
			component.onKeydown(createKeyEvent('Backspace'));

			const blocks = state.value() as Record<string, unknown>[];
			expect(blocks).toHaveLength(1);
			expect(blocks[0]['blockType']).toBe('hero');
		});

		it('should not remove block on Delete when canRemoveBlock is false', () => {
			const field = createMockBlocksField({ minRows: 1 });
			const { component, state } = createComponent({
				field,
				blocks: [{ blockType: 'hero', heading: 'A' }],
			});

			component.editorState.selectedBlockIndex.set(0);
			component.onKeydown(createKeyEvent('Delete'));

			const blocks = state.value() as Record<string, unknown>[];
			expect(blocks).toHaveLength(1);
		});

		it('should not remove block on Delete when no selection', () => {
			const { component, state } = createComponent({
				blocks: [{ blockType: 'hero', heading: 'A' }],
			});

			component.onKeydown(createKeyEvent('Delete'));

			const blocks = state.value() as Record<string, unknown>[];
			expect(blocks).toHaveLength(1);
		});
	});

	describe('collapse management', () => {
		it('should have no collapsed blocks initially', () => {
			const { component } = createComponent({
				blocks: [{ blockType: 'hero', heading: 'A' }],
			});
			expect(component.isBlockCollapsed(0)).toBe(false);
		});

		it('should toggle a block collapsed', () => {
			const { component } = createComponent({
				blocks: [{ blockType: 'hero', heading: 'A' }],
			});
			component.toggleBlockCollapse(0);
			expect(component.isBlockCollapsed(0)).toBe(true);
		});

		it('should toggle a collapsed block back to expanded', () => {
			const { component } = createComponent({
				blocks: [{ blockType: 'hero', heading: 'A' }],
			});
			component.toggleBlockCollapse(0);
			component.toggleBlockCollapse(0);
			expect(component.isBlockCollapsed(0)).toBe(false);
		});

		it('should track multiple collapsed blocks independently', () => {
			const { component } = createComponent({
				blocks: [
					{ blockType: 'hero', heading: 'A' },
					{ blockType: 'textBlock', body: 'B' },
					{ blockType: 'hero', heading: 'C' },
				],
			});
			component.toggleBlockCollapse(0);
			component.toggleBlockCollapse(2);
			expect(component.isBlockCollapsed(0)).toBe(true);
			expect(component.isBlockCollapsed(1)).toBe(false);
			expect(component.isBlockCollapsed(2)).toBe(true);
		});

		it('should shift collapsed indices up when adding a block before them', () => {
			const { component } = createComponent({
				blocks: [
					{ blockType: 'hero', heading: 'A' },
					{ blockType: 'textBlock', body: 'B' },
				],
			});
			component.toggleBlockCollapse(1);
			expect(component.isBlockCollapsed(1)).toBe(true);

			component.addBlock('hero', 0);

			// The collapsed block at index 1 should now be at index 2
			expect(component.isBlockCollapsed(1)).toBe(false);
			expect(component.isBlockCollapsed(2)).toBe(true);
		});

		it('should not shift collapsed indices when adding a block after them', () => {
			const { component } = createComponent({
				blocks: [
					{ blockType: 'hero', heading: 'A' },
					{ blockType: 'textBlock', body: 'B' },
				],
			});
			component.toggleBlockCollapse(0);

			component.addBlock('hero', 2);

			expect(component.isBlockCollapsed(0)).toBe(true);
			expect(component.isBlockCollapsed(2)).toBe(false);
		});

		it('should shift collapsed indices down when removing a block before them', () => {
			const { component } = createComponent({
				blocks: [
					{ blockType: 'hero', heading: 'A' },
					{ blockType: 'textBlock', body: 'B' },
					{ blockType: 'hero', heading: 'C' },
				],
			});
			component.toggleBlockCollapse(2);
			expect(component.isBlockCollapsed(2)).toBe(true);

			component.removeBlock(0);

			// The collapsed block at index 2 should now be at index 1
			expect(component.isBlockCollapsed(2)).toBe(false);
			expect(component.isBlockCollapsed(1)).toBe(true);
		});

		it('should remove collapsed state when removing a collapsed block', () => {
			const { component } = createComponent({
				blocks: [
					{ blockType: 'hero', heading: 'A' },
					{ blockType: 'textBlock', body: 'B' },
				],
			});
			component.toggleBlockCollapse(0);

			component.removeBlock(0);

			expect(component.isBlockCollapsed(0)).toBe(false);
		});

		it('should swap collapsed state when moving blocks', () => {
			const { component } = createComponent({
				blocks: [
					{ blockType: 'hero', heading: 'A' },
					{ blockType: 'textBlock', body: 'B' },
					{ blockType: 'hero', heading: 'C' },
				],
			});
			component.toggleBlockCollapse(0);
			expect(component.isBlockCollapsed(0)).toBe(true);
			expect(component.isBlockCollapsed(1)).toBe(false);

			component.moveBlock(0, 1);

			// Block 0 was collapsed, moved to index 1 — now index 1 should be collapsed
			expect(component.isBlockCollapsed(0)).toBe(false);
			expect(component.isBlockCollapsed(1)).toBe(true);
		});

		it('should swap collapsed state correctly when both blocks have different states', () => {
			const { component } = createComponent({
				blocks: [
					{ blockType: 'hero', heading: 'A' },
					{ blockType: 'textBlock', body: 'B' },
				],
			});
			component.toggleBlockCollapse(1);
			expect(component.isBlockCollapsed(0)).toBe(false);
			expect(component.isBlockCollapsed(1)).toBe(true);

			component.moveBlock(0, 1);

			// Block 0 (expanded) swapped with block 1 (collapsed)
			expect(component.isBlockCollapsed(0)).toBe(true);
			expect(component.isBlockCollapsed(1)).toBe(false);
		});
	});

	describe('minRows and maxRows', () => {
		it('should extract minRows from blocks field', () => {
			const field = createMockBlocksField({ minRows: 2 });
			const { component } = createComponent({ field });
			expect(component.minRows()).toBe(2);
		});

		it('should default minRows to 0', () => {
			const { component } = createComponent();
			expect(component.minRows()).toBe(0);
		});

		it('should extract maxRows from blocks field', () => {
			const field = createMockBlocksField({ maxRows: 5 });
			const { component } = createComponent({ field });
			expect(component.maxRows()).toBe(5);
		});

		it('should return undefined maxRows when not set', () => {
			const { component } = createComponent();
			expect(component.maxRows()).toBeUndefined();
		});
	});
});
