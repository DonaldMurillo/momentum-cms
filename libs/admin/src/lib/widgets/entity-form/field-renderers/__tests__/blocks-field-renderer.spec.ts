import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BlocksFieldRenderer } from '../blocks-field.component';
import { createMockFieldNodeState, createMockField } from './test-helpers';

describe('BlocksFieldRenderer', () => {
	let fixture: ComponentFixture<BlocksFieldRenderer>;
	let component: BlocksFieldRenderer;

	const heroBlock = {
		slug: 'hero',
		labels: { singular: 'Hero', plural: 'Heroes' },
		fields: [
			createMockField('text', { name: 'heading', label: 'Heading' }),
			createMockField('text', { name: 'subheading', label: 'Subheading' }),
		],
	};

	const ctaBlock = {
		slug: 'cta',
		labels: { singular: 'CTA', plural: 'CTAs' },
		fields: [createMockField('text', { name: 'buttonText', label: 'Button Text' })],
	};

	function setup(
		fieldOverrides: Record<string, unknown> = {},
		initialValue: unknown = [],
	): ReturnType<typeof createMockFieldNodeState> {
		const mock = createMockFieldNodeState(initialValue);
		TestBed.configureTestingModule({
			imports: [BlocksFieldRenderer],
		}).compileComponents();

		fixture = TestBed.createComponent(BlocksFieldRenderer);
		component = fixture.componentInstance;
		fixture.componentRef.setInput(
			'field',
			createMockField('blocks', {
				blocks: [heroBlock, ctaBlock],
				...fieldOverrides,
			}),
		);
		fixture.componentRef.setInput('path', 'content');
		fixture.componentRef.setInput('formNode', mock.node);
		fixture.detectChanges();
		return mock;
	}

	it('should create the component', () => {
		setup();
		expect(component).toBeTruthy();
	});

	describe('label', () => {
		it('should use field label when provided', () => {
			setup({ label: 'Page Content' });
			expect(component.label()).toBe('Page Content');
		});

		it('should humanize field name when no label', () => {
			setup({ label: '', name: 'pageBlocks' });
			expect(component.label()).toBe('Page Blocks');
		});
	});

	describe('blockDefinitions', () => {
		it('should return block configs for blocks type', () => {
			setup();
			const defs = component.blockDefinitions();
			expect(defs).toHaveLength(2);
			expect(defs[0].slug).toBe('hero');
			expect(defs[1].slug).toBe('cta');
		});

		it('should return empty array for non-blocks type', () => {
			TestBed.configureTestingModule({
				imports: [BlocksFieldRenderer],
			}).compileComponents();

			fixture = TestBed.createComponent(BlocksFieldRenderer);
			component = fixture.componentInstance;
			fixture.componentRef.setInput('field', createMockField('text', { name: 'plainText' }));
			fixture.componentRef.setInput('path', 'plainText');
			fixture.detectChanges();

			expect(component.blockDefinitions()).toEqual([]);
		});
	});

	describe('blocks', () => {
		it('should return typed block items from state', () => {
			setup({}, [
				{ blockType: 'hero', heading: 'Hello', subheading: 'World' },
				{ blockType: 'cta', buttonText: 'Click Me' },
			]);
			const blocks = component.blocks();
			expect(blocks).toHaveLength(2);
			expect(blocks[0]).toEqual({
				blockType: 'hero',
				heading: 'Hello',
				subheading: 'World',
			});
			expect(blocks[1]).toEqual({ blockType: 'cta', buttonText: 'Click Me' });
		});

		it('should filter items without a valid blockType', () => {
			setup({}, [
				{ blockType: 'hero', heading: 'Valid' },
				{ noBlockType: true },
				'not-an-object',
				{ blockType: 123 },
				{ blockType: 'cta', buttonText: 'Also Valid' },
			]);
			const blocks = component.blocks();
			expect(blocks).toHaveLength(2);
			expect(blocks[0].blockType).toBe('hero');
			expect(blocks[1].blockType).toBe('cta');
		});

		it('should return empty array when no state', () => {
			TestBed.configureTestingModule({
				imports: [BlocksFieldRenderer],
			}).compileComponents();

			fixture = TestBed.createComponent(BlocksFieldRenderer);
			component = fixture.componentInstance;
			fixture.componentRef.setInput(
				'field',
				createMockField('blocks', {
					blocks: [heroBlock],
				}),
			);
			fixture.componentRef.setInput('path', 'content');
			// formNode defaults to null — no state
			fixture.detectChanges();

			expect(component.blocks()).toEqual([]);
		});
	});

	describe('minRows', () => {
		it('should return minRows from field config', () => {
			setup({ minRows: 1 });
			expect(component.minRows()).toBe(1);
		});

		it('should default to 0 when not set', () => {
			setup();
			expect(component.minRows()).toBe(0);
		});
	});

	describe('maxRows', () => {
		it('should return maxRows from field config', () => {
			setup({ maxRows: 5 });
			expect(component.maxRows()).toBe(5);
		});

		it('should return undefined when not set', () => {
			setup();
			expect(component.maxRows()).toBeUndefined();
		});
	});

	describe('isDisabled', () => {
		it('should be false in create mode', () => {
			setup();
			expect(component.isDisabled()).toBe(false);
		});

		it('should be true in view mode', () => {
			setup();
			fixture.componentRef.setInput('mode', 'view');
			fixture.detectChanges();
			expect(component.isDisabled()).toBe(true);
		});
	});

	describe('canAddBlock', () => {
		it('should be true when under max', () => {
			setup({ maxRows: 5 }, [{ blockType: 'hero', heading: '', subheading: '' }]);
			expect(component.canAddBlock()).toBe(true);
		});

		it('should be true when no max is set', () => {
			setup({}, [{ blockType: 'hero', heading: '', subheading: '' }]);
			expect(component.canAddBlock()).toBe(true);
		});

		it('should be false when at max', () => {
			setup({ maxRows: 2 }, [
				{ blockType: 'hero', heading: '', subheading: '' },
				{ blockType: 'cta', buttonText: '' },
			]);
			expect(component.canAddBlock()).toBe(false);
		});

		it('should be false when disabled', () => {
			setup({ maxRows: 5 }, [{ blockType: 'hero', heading: '', subheading: '' }]);
			fixture.componentRef.setInput('mode', 'view');
			fixture.detectChanges();
			expect(component.canAddBlock()).toBe(false);
		});
	});

	describe('canRemoveBlock', () => {
		it('should be true when above min', () => {
			setup({ minRows: 0 }, [
				{ blockType: 'hero', heading: '', subheading: '' },
				{ blockType: 'cta', buttonText: '' },
			]);
			expect(component.canRemoveBlock()).toBe(true);
		});

		it('should be false at min', () => {
			setup({ minRows: 1 }, [{ blockType: 'hero', heading: '', subheading: '' }]);
			expect(component.canRemoveBlock()).toBe(false);
		});

		it('should be false when disabled', () => {
			setup({ minRows: 0 }, [{ blockType: 'hero', heading: '', subheading: '' }]);
			fixture.componentRef.setInput('mode', 'view');
			fixture.detectChanges();
			expect(component.canRemoveBlock()).toBe(false);
		});
	});

	describe('getBlockLabel', () => {
		it('should return singular label from block definition', () => {
			setup();
			expect(component.getBlockLabel('hero')).toBe('Hero');
			expect(component.getBlockLabel('cta')).toBe('CTA');
		});

		it('should fallback to slug when no labels defined', () => {
			setup({
				blocks: [{ slug: 'raw', fields: [createMockField('text', { name: 'code' })] }],
			});
			expect(component.getBlockLabel('raw')).toBe('raw');
		});

		it('should return blockType string for unknown block types', () => {
			setup();
			expect(component.getBlockLabel('unknown')).toBe('unknown');
		});
	});

	describe('getBlockFields', () => {
		it('should return fields for a block type', () => {
			setup();
			const fields = component.getBlockFields('hero');
			expect(fields).toHaveLength(2);
			expect(fields[0].name).toBe('heading');
			expect(fields[1].name).toBe('subheading');
		});

		it('should filter hidden fields', () => {
			setup({
				blocks: [
					{
						slug: 'hero',
						labels: { singular: 'Hero', plural: 'Heroes' },
						fields: [
							createMockField('text', { name: 'heading', label: 'Heading' }),
							createMockField('text', {
								name: 'hidden',
								label: 'Hidden',
								admin: { hidden: true },
							}),
							createMockField('text', { name: 'subheading', label: 'Subheading' }),
						],
					},
				],
			});
			const fields = component.getBlockFields('hero');
			expect(fields).toHaveLength(2);
			expect(fields[0].name).toBe('heading');
			expect(fields[1].name).toBe('subheading');
		});

		it('should return empty array for unknown block type', () => {
			setup();
			expect(component.getBlockFields('unknown')).toEqual([]);
		});
	});

	describe('collapse/expand', () => {
		it('should start with all blocks expanded', () => {
			setup({}, [
				{ blockType: 'hero', heading: 'A', subheading: 'B' },
				{ blockType: 'cta', buttonText: 'Click' },
			]);
			expect(component.isBlockCollapsed(0)).toBe(false);
			expect(component.isBlockCollapsed(1)).toBe(false);
		});

		it('should collapse a block when toggled', () => {
			setup({}, [
				{ blockType: 'hero', heading: 'A', subheading: 'B' },
				{ blockType: 'cta', buttonText: 'Click' },
			]);
			component.toggleBlockCollapse(0);
			expect(component.isBlockCollapsed(0)).toBe(true);
			expect(component.isBlockCollapsed(1)).toBe(false);
		});

		it('should expand a collapsed block when toggled again', () => {
			setup({}, [{ blockType: 'hero', heading: 'A', subheading: 'B' }]);
			component.toggleBlockCollapse(0);
			expect(component.isBlockCollapsed(0)).toBe(true);

			component.toggleBlockCollapse(0);
			expect(component.isBlockCollapsed(0)).toBe(false);
		});

		it('should track collapse state independently per block', () => {
			setup({}, [
				{ blockType: 'hero', heading: 'A', subheading: 'B' },
				{ blockType: 'cta', buttonText: 'Click' },
				{ blockType: 'hero', heading: 'C', subheading: 'D' },
			]);
			component.toggleBlockCollapse(0);
			component.toggleBlockCollapse(2);

			expect(component.isBlockCollapsed(0)).toBe(true);
			expect(component.isBlockCollapsed(1)).toBe(false);
			expect(component.isBlockCollapsed(2)).toBe(true);
		});

		it('should hide block fields in template when collapsed', () => {
			setup({}, [
				{ blockType: 'hero', heading: 'A', subheading: 'B' },
				{ blockType: 'cta', buttonText: 'Click' },
			]);

			// Both block field sections should be visible initially
			const blockFields = fixture.nativeElement.querySelectorAll('[data-testid="block-fields"]');
			expect(blockFields.length).toBe(2);

			// Collapse first block
			component.toggleBlockCollapse(0);
			fixture.detectChanges();

			const afterCollapse = fixture.nativeElement.querySelectorAll('[data-testid="block-fields"]');
			expect(afterCollapse.length).toBe(1);
		});

		it('should update aria-expanded on collapse toggle button', () => {
			setup({}, [{ blockType: 'hero', heading: 'A', subheading: 'B' }]);

			const collapseBtn = fixture.nativeElement.querySelector(
				'[data-testid="block-collapse-toggle"]',
			);
			expect(collapseBtn).toBeTruthy();
			expect(collapseBtn.getAttribute('aria-expanded')).toBe('true');
			expect(collapseBtn.getAttribute('aria-label')).toBe('Collapse block');

			component.toggleBlockCollapse(0);
			fixture.detectChanges();

			expect(collapseBtn.getAttribute('aria-expanded')).toBe('false');
			expect(collapseBtn.getAttribute('aria-label')).toBe('Expand block');
		});
	});

	describe('collapse state after removeBlock', () => {
		it('should clear collapse state of the removed block', () => {
			setup({}, [
				{ blockType: 'hero', heading: 'A', subheading: 'B' },
				{ blockType: 'cta', buttonText: 'Click' },
				{ blockType: 'hero', heading: 'C', subheading: 'D' },
			]);
			component.toggleBlockCollapse(1);
			expect(component.isBlockCollapsed(1)).toBe(true);

			component.removeBlock(1);
			fixture.detectChanges();

			// Index 1 is now old block 2 — should not be collapsed
			expect(component.isBlockCollapsed(0)).toBe(false);
			expect(component.isBlockCollapsed(1)).toBe(false);
		});

		it('should shift collapsed indices down when a lower block is removed', () => {
			setup({}, [
				{ blockType: 'hero', heading: 'A', subheading: 'B' },
				{ blockType: 'cta', buttonText: 'Click' },
				{ blockType: 'hero', heading: 'C', subheading: 'D' },
			]);
			component.toggleBlockCollapse(2);
			expect(component.isBlockCollapsed(2)).toBe(true);

			component.removeBlock(0);
			fixture.detectChanges();

			// Old block 2 is now at index 1
			expect(component.isBlockCollapsed(0)).toBe(false);
			expect(component.isBlockCollapsed(1)).toBe(true);
		});

		it('should not shift collapsed indices below the removed index', () => {
			setup({}, [
				{ blockType: 'hero', heading: 'A', subheading: 'B' },
				{ blockType: 'cta', buttonText: 'Click' },
				{ blockType: 'hero', heading: 'C', subheading: 'D' },
			]);
			component.toggleBlockCollapse(0);
			expect(component.isBlockCollapsed(0)).toBe(true);

			component.removeBlock(2);
			fixture.detectChanges();

			// Block 0 should remain collapsed
			expect(component.isBlockCollapsed(0)).toBe(true);
			expect(component.isBlockCollapsed(1)).toBe(false);
		});
	});

	describe('collapse state after reorder (onDrop)', () => {
		it('should move collapse state when a block is dragged forward', () => {
			setup({}, [
				{ blockType: 'hero', heading: 'A', subheading: 'B' },
				{ blockType: 'cta', buttonText: 'Click' },
				{ blockType: 'hero', heading: 'C', subheading: 'D' },
			]);
			component.toggleBlockCollapse(0);
			expect(component.isBlockCollapsed(0)).toBe(true);

			// Drag block 0 to position 2
			component.onDrop({ previousIndex: 0, currentIndex: 2 } as any);
			fixture.detectChanges();

			expect(component.isBlockCollapsed(0)).toBe(false);
			expect(component.isBlockCollapsed(1)).toBe(false);
			expect(component.isBlockCollapsed(2)).toBe(true);
		});

		it('should move collapse state when a block is dragged backward', () => {
			setup({}, [
				{ blockType: 'hero', heading: 'A', subheading: 'B' },
				{ blockType: 'cta', buttonText: 'Click' },
				{ blockType: 'hero', heading: 'C', subheading: 'D' },
			]);
			component.toggleBlockCollapse(2);
			expect(component.isBlockCollapsed(2)).toBe(true);

			// Drag block 2 to position 0
			component.onDrop({ previousIndex: 2, currentIndex: 0 } as any);
			fixture.detectChanges();

			expect(component.isBlockCollapsed(0)).toBe(true);
			expect(component.isBlockCollapsed(1)).toBe(false);
			expect(component.isBlockCollapsed(2)).toBe(false);
		});

		it('should shift intermediate block indices when dragging forward', () => {
			setup({}, [
				{ blockType: 'hero', heading: 'A', subheading: 'B' },
				{ blockType: 'cta', buttonText: 'Click' },
				{ blockType: 'hero', heading: 'C', subheading: 'D' },
			]);
			// Collapse block 1 (middle)
			component.toggleBlockCollapse(1);
			expect(component.isBlockCollapsed(1)).toBe(true);

			// Drag block 0 to position 2 — block 1 should shift to index 0
			component.onDrop({ previousIndex: 0, currentIndex: 2 } as any);
			fixture.detectChanges();

			expect(component.isBlockCollapsed(0)).toBe(true);
			expect(component.isBlockCollapsed(1)).toBe(false);
			expect(component.isBlockCollapsed(2)).toBe(false);
		});

		it('should handle multiple collapsed blocks during reorder', () => {
			setup({}, [
				{ blockType: 'hero', heading: 'A', subheading: 'B' },
				{ blockType: 'cta', buttonText: 'Click' },
				{ blockType: 'hero', heading: 'C', subheading: 'D' },
			]);
			component.toggleBlockCollapse(0);
			component.toggleBlockCollapse(2);

			// Drag block 0 to position 2
			component.onDrop({ previousIndex: 0, currentIndex: 2 } as any);
			fixture.detectChanges();

			// Old block 0 moved to 2, old block 2 shifted to 1
			expect(component.isBlockCollapsed(0)).toBe(false);
			expect(component.isBlockCollapsed(1)).toBe(true);
			expect(component.isBlockCollapsed(2)).toBe(true);
		});
	});

	describe('getBlockSubFieldPath', () => {
		it('should build correct path', () => {
			setup();
			expect(component.getBlockSubFieldPath(0, 'heading')).toBe('content.0.heading');
			expect(component.getBlockSubFieldPath(2, 'buttonText')).toBe('content.2.buttonText');
		});
	});

	describe('addBlock', () => {
		it('should add a new block with blockType and default values', () => {
			const mock = setup({}, [{ blockType: 'cta', buttonText: 'Existing' }]);
			component.addBlock('hero');

			const updatedBlocks = mock.state.value() as Record<string, unknown>[];
			expect(updatedBlocks).toHaveLength(2);
			expect(updatedBlocks[0]).toEqual({ blockType: 'cta', buttonText: 'Existing' });
			expect(updatedBlocks[1]).toEqual({
				blockType: 'hero',
				heading: '',
				subheading: '',
			});
		});

		it('should do nothing for unknown block type', () => {
			const mock = setup({}, [{ blockType: 'hero', heading: '', subheading: '' }]);
			component.addBlock('nonexistent');

			const updatedBlocks = mock.state.value() as Record<string, unknown>[];
			expect(updatedBlocks).toHaveLength(1);
		});

		it('should do nothing when no state', () => {
			TestBed.configureTestingModule({
				imports: [BlocksFieldRenderer],
			}).compileComponents();

			fixture = TestBed.createComponent(BlocksFieldRenderer);
			component = fixture.componentInstance;
			fixture.componentRef.setInput(
				'field',
				createMockField('blocks', {
					blocks: [heroBlock],
				}),
			);
			fixture.componentRef.setInput('path', 'content');
			fixture.detectChanges();

			// Should not throw when formNode is null
			expect(() => component.addBlock('hero')).not.toThrow();
		});
	});

	describe('removeBlock', () => {
		it('should remove block at index', () => {
			const mock = setup({}, [
				{ blockType: 'hero', heading: 'First', subheading: 'A' },
				{ blockType: 'cta', buttonText: 'Middle' },
				{ blockType: 'hero', heading: 'Last', subheading: 'C' },
			]);
			component.removeBlock(1);

			const updatedBlocks = mock.state.value() as Record<string, unknown>[];
			expect(updatedBlocks).toHaveLength(2);
			expect(updatedBlocks[0]).toEqual({
				blockType: 'hero',
				heading: 'First',
				subheading: 'A',
			});
			expect(updatedBlocks[1]).toEqual({
				blockType: 'hero',
				heading: 'Last',
				subheading: 'C',
			});
		});

		it('should do nothing when no state', () => {
			TestBed.configureTestingModule({
				imports: [BlocksFieldRenderer],
			}).compileComponents();

			fixture = TestBed.createComponent(BlocksFieldRenderer);
			component = fixture.componentInstance;
			fixture.componentRef.setInput(
				'field',
				createMockField('blocks', {
					blocks: [heroBlock],
				}),
			);
			fixture.componentRef.setInput('path', 'content');
			fixture.detectChanges();

			// Should not throw when formNode is null
			expect(() => component.removeBlock(0)).not.toThrow();
		});
	});
});
