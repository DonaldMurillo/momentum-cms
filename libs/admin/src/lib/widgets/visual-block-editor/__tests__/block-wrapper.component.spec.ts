import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BlockWrapperComponent } from '../block-wrapper.component';
import type { BlockConfig, Field } from '@momentumcms/core';
import type { BlockItem } from '../visual-editor.types';

function makeField(name: string, overrides: Partial<Field> = {}): Field {
	return { name, type: 'text', label: name, ...overrides } as Field;
}

function makeBlockConfig(fields: Field[], slug = 'hero'): BlockConfig {
	return { slug, fields } as BlockConfig;
}

describe('BlockWrapperComponent', () => {
	let fixture: ComponentFixture<BlockWrapperComponent>;
	let component: BlockWrapperComponent;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [BlockWrapperComponent],
		})
			.overrideComponent(BlockWrapperComponent, {
				set: { template: '<div></div>', imports: [], providers: [] },
			})
			.compileComponents();

		fixture = TestBed.createComponent(BlockWrapperComponent);
		component = fixture.componentInstance;
	});

	function setRequiredInputs(
		overrides: {
			block?: BlockItem;
			blockIndex?: number;
			blockConfig?: BlockConfig;
			blockLabel?: string;
		} = {},
	): void {
		fixture.componentRef.setInput(
			'block',
			overrides.block ?? { blockType: 'hero', heading: 'Test' },
		);
		fixture.componentRef.setInput('blockIndex', overrides.blockIndex ?? 0);
		fixture.componentRef.setInput(
			'blockConfig',
			overrides.blockConfig ?? makeBlockConfig([makeField('title'), makeField('body')]),
		);
		fixture.componentRef.setInput('blockLabel', overrides.blockLabel ?? 'Hero');
		fixture.detectChanges();
	}

	describe('visibleFields', () => {
		it('should return all fields when none are hidden', () => {
			const fields = [makeField('title'), makeField('body'), makeField('image')];
			setRequiredInputs({ blockConfig: makeBlockConfig(fields) });

			const visible = component.visibleFields();
			expect(visible).toHaveLength(3);
			expect(visible.map((f) => f.name)).toEqual(['title', 'body', 'image']);
		});

		it('should filter out fields with admin.hidden = true', () => {
			const fields = [
				makeField('title'),
				makeField('internalId', { admin: { hidden: true } }),
				makeField('body'),
				makeField('secret', { admin: { hidden: true } }),
			];
			setRequiredInputs({ blockConfig: makeBlockConfig(fields) });

			const visible = component.visibleFields();
			expect(visible).toHaveLength(2);
			expect(visible.map((f) => f.name)).toEqual(['title', 'body']);
		});

		it('should return empty array when all fields are hidden', () => {
			const fields = [
				makeField('a', { admin: { hidden: true } }),
				makeField('b', { admin: { hidden: true } }),
			];
			setRequiredInputs({ blockConfig: makeBlockConfig(fields) });

			const visible = component.visibleFields();
			expect(visible).toHaveLength(0);
		});

		it('should keep fields that have admin config but hidden is false', () => {
			const fields = [
				makeField('title', { admin: { hidden: false } }),
				makeField('subtitle', { admin: { readOnly: true } }),
			];
			setRequiredInputs({ blockConfig: makeBlockConfig(fields) });

			const visible = component.visibleFields();
			expect(visible).toHaveLength(2);
			expect(visible.map((f) => f.name)).toEqual(['title', 'subtitle']);
		});

		it('should keep fields with no admin config', () => {
			const fields = [makeField('title'), makeField('body')];
			setRequiredInputs({ blockConfig: makeBlockConfig(fields) });

			const visible = component.visibleFields();
			expect(visible).toHaveLength(2);
		});
	});

	describe('blockAriaLabel', () => {
		it('should return formatted label with position', () => {
			setRequiredInputs({ blockLabel: 'Hero', blockIndex: 0 });

			expect(component.blockAriaLabel()).toBe('Hero block, position 1');
		});

		it('should use 1-based index (blockIndex 0 -> position 1)', () => {
			setRequiredInputs({ blockIndex: 0 });
			expect(component.blockAriaLabel()).toBe('Hero block, position 1');
		});

		it('should use 1-based index (blockIndex 4 -> position 5)', () => {
			setRequiredInputs({ blockIndex: 4 });
			expect(component.blockAriaLabel()).toBe('Hero block, position 5');
		});

		it('should reflect different blockLabel values', () => {
			setRequiredInputs({ blockLabel: 'Call To Action', blockIndex: 2 });
			expect(component.blockAriaLabel()).toBe('Call To Action block, position 3');
		});

		it('should update when blockIndex changes', () => {
			setRequiredInputs({ blockIndex: 0 });
			expect(component.blockAriaLabel()).toBe('Hero block, position 1');

			fixture.componentRef.setInput('blockIndex', 9);
			expect(component.blockAriaLabel()).toBe('Hero block, position 10');
		});
	});

	describe('getBlockSubFieldPath', () => {
		it('should combine path, blockIndex, and fieldName', () => {
			setRequiredInputs({ blockIndex: 1 });
			fixture.componentRef.setInput('path', 'content');

			expect(component.getBlockSubFieldPath('title')).toBe('content.1.title');
		});

		it('should handle nested paths', () => {
			setRequiredInputs({ blockIndex: 3 });
			fixture.componentRef.setInput('path', 'sections.blocks');

			expect(component.getBlockSubFieldPath('heading')).toBe('sections.blocks.3.heading');
		});

		it('should work with blockIndex 0', () => {
			setRequiredInputs({ blockIndex: 0 });
			fixture.componentRef.setInput('path', 'layout');

			expect(component.getBlockSubFieldPath('image')).toBe('layout.0.image');
		});

		it('should handle empty path', () => {
			setRequiredInputs({ blockIndex: 2 });
			// path defaults to ''
			expect(component.getBlockSubFieldPath('title')).toBe('.2.title');
		});
	});

	describe('getBlockSubNode', () => {
		it('should return null when formNode is null', () => {
			setRequiredInputs();
			// formNode defaults to null
			const result = component.getBlockSubNode('title');
			expect(result).toBeNull();
		});

		it('should return null when formNode is undefined', () => {
			setRequiredInputs();
			fixture.componentRef.setInput('formNode', undefined);

			const result = component.getBlockSubNode('title');
			expect(result).toBeNull();
		});

		it('should traverse formNode by blockIndex then fieldName', () => {
			setRequiredInputs({ blockIndex: 1 });

			const titleNode = { value: 'Hello' };
			const blockNode = { title: titleNode, body: { value: 'World' } };
			const formNode = { '1': blockNode };
			fixture.componentRef.setInput('formNode', formNode);

			const result = component.getBlockSubNode('title');
			expect(result).toBe(titleNode);
		});

		it('should return null when blockIndex key does not exist in formNode', () => {
			setRequiredInputs({ blockIndex: 5 });

			const formNode = { '0': { title: { value: 'X' } } };
			fixture.componentRef.setInput('formNode', formNode);

			const result = component.getBlockSubNode('title');
			expect(result).toBeNull();
		});

		it('should return null when fieldName key does not exist in block node', () => {
			setRequiredInputs({ blockIndex: 0 });

			const formNode = { '0': { title: { value: 'X' } } };
			fixture.componentRef.setInput('formNode', formNode);

			const result = component.getBlockSubNode('nonexistent');
			expect(result).toBeNull();
		});

		it('should handle blockIndex 0 correctly', () => {
			setRequiredInputs({ blockIndex: 0 });

			const bodyNode = { value: 'content' };
			const formNode = { '0': { body: bodyNode } };
			fixture.componentRef.setInput('formNode', formNode);

			const result = component.getBlockSubNode('body');
			expect(result).toBe(bodyNode);
		});
	});

	describe('default input values', () => {
		beforeEach(() => {
			setRequiredInputs();
		});

		it('isSelected should default to false', () => {
			expect(component.isSelected()).toBe(false);
		});

		it('isHovered should default to false', () => {
			expect(component.isHovered()).toBe(false);
		});

		it('isDisabled should default to false', () => {
			expect(component.isDisabled()).toBe(false);
		});

		it('isCollapsed should default to false', () => {
			expect(component.isCollapsed()).toBe(false);
		});

		it('canMoveUp should default to true', () => {
			expect(component.canMoveUp()).toBe(true);
		});

		it('canMoveDown should default to true', () => {
			expect(component.canMoveDown()).toBe(true);
		});

		it('canDelete should default to true', () => {
			expect(component.canDelete()).toBe(true);
		});

		it('mode should default to edit', () => {
			expect(component.mode()).toBe('edit');
		});

		it('path should default to empty string', () => {
			expect(component.path()).toBe('');
		});

		it('formNode should default to null', () => {
			expect(component.formNode()).toBeNull();
		});

		it('formTree should default to null', () => {
			expect(component.formTree()).toBeNull();
		});

		it('formModel should default to empty object', () => {
			expect(component.formModel()).toEqual({});
		});
	});

	describe('setting optional inputs', () => {
		beforeEach(() => {
			setRequiredInputs();
		});

		it('should accept isSelected = true', () => {
			fixture.componentRef.setInput('isSelected', true);
			expect(component.isSelected()).toBe(true);
		});

		it('should accept isHovered = true', () => {
			fixture.componentRef.setInput('isHovered', true);
			expect(component.isHovered()).toBe(true);
		});

		it('should accept isDisabled = true', () => {
			fixture.componentRef.setInput('isDisabled', true);
			expect(component.isDisabled()).toBe(true);
		});

		it('should accept isCollapsed = true', () => {
			fixture.componentRef.setInput('isCollapsed', true);
			expect(component.isCollapsed()).toBe(true);
		});

		it('should accept canMoveUp = false', () => {
			fixture.componentRef.setInput('canMoveUp', false);
			expect(component.canMoveUp()).toBe(false);
		});

		it('should accept canMoveDown = false', () => {
			fixture.componentRef.setInput('canMoveDown', false);
			expect(component.canMoveDown()).toBe(false);
		});

		it('should accept canDelete = false', () => {
			fixture.componentRef.setInput('canDelete', false);
			expect(component.canDelete()).toBe(false);
		});

		it('should accept mode = create', () => {
			fixture.componentRef.setInput('mode', 'create');
			expect(component.mode()).toBe('create');
		});

		it('should accept mode = view', () => {
			fixture.componentRef.setInput('mode', 'view');
			expect(component.mode()).toBe('view');
		});
	});

	describe('outputs', () => {
		beforeEach(() => {
			setRequiredInputs();
		});

		it('should have selected output defined', () => {
			expect(component.selected).toBeDefined();
		});

		it('should have hoverStart output defined', () => {
			expect(component.hoverStart).toBeDefined();
		});

		it('should have hoverEnd output defined', () => {
			expect(component.hoverEnd).toBeDefined();
		});

		it('should have moveUp output defined', () => {
			expect(component.moveUp).toBeDefined();
		});

		it('should have moveDown output defined', () => {
			expect(component.moveDown).toBeDefined();
		});

		it('should have deleteBlock output defined', () => {
			expect(component.deleteBlock).toBeDefined();
		});

		it('should have toggleCollapse output defined', () => {
			expect(component.toggleCollapse).toBeDefined();
		});
	});

	describe('required inputs', () => {
		it('should read block input correctly', () => {
			const block: BlockItem = { blockType: 'cta', label: 'Sign Up' };
			setRequiredInputs({ block });
			expect(component.block()).toBe(block);
		});

		it('should read blockIndex input correctly', () => {
			setRequiredInputs({ blockIndex: 7 });
			expect(component.blockIndex()).toBe(7);
		});

		it('should read blockConfig input correctly', () => {
			const config = makeBlockConfig([makeField('heading')], 'cta');
			setRequiredInputs({ blockConfig: config });
			expect(component.blockConfig()).toBe(config);
		});

		it('should read blockLabel input correctly', () => {
			setRequiredInputs({ blockLabel: 'Call To Action' });
			expect(component.blockLabel()).toBe('Call To Action');
		});
	});

	describe('computed reactivity', () => {
		it('visibleFields should update when blockConfig changes', () => {
			const fieldsA = [makeField('a'), makeField('b')];
			setRequiredInputs({ blockConfig: makeBlockConfig(fieldsA) });
			expect(component.visibleFields()).toHaveLength(2);

			const fieldsB = [makeField('x')];
			fixture.componentRef.setInput('blockConfig', makeBlockConfig(fieldsB));
			expect(component.visibleFields()).toHaveLength(1);
			expect(component.visibleFields()[0].name).toBe('x');
		});

		it('blockAriaLabel should update when blockLabel changes', () => {
			setRequiredInputs({ blockLabel: 'Alpha', blockIndex: 0 });
			expect(component.blockAriaLabel()).toBe('Alpha block, position 1');

			fixture.componentRef.setInput('blockLabel', 'Beta');
			expect(component.blockAriaLabel()).toBe('Beta block, position 1');
		});
	});
});
