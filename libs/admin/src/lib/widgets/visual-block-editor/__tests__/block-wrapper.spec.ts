import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { BlockWrapperComponent } from '../block-wrapper.component';
import type { BlockItem } from '../visual-editor.types';

@Component({ selector: 'mcms-field-renderer', template: '' })
class MockFieldRenderer {}

const mockBlockConfig = {
	slug: 'hero',
	labels: { singular: 'Hero Section' },
	fields: [
		{ name: 'title', type: 'text', label: 'Title' },
		{ name: 'subtitle', type: 'text', label: 'Subtitle' },
		{ name: 'internal', type: 'text', label: 'Internal', admin: { hidden: true } },
	],
};

const mockBlock: BlockItem = {
	blockType: 'hero',
	id: 'block-1',
};

describe('BlockWrapperComponent', () => {
	let fixture: ComponentFixture<BlockWrapperComponent>;
	let component: BlockWrapperComponent;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [BlockWrapperComponent],
		})
			.overrideComponent(BlockWrapperComponent, {
				set: {
					imports: [MockFieldRenderer],
					template: '<div></div>',
				},
			})
			.compileComponents();

		fixture = TestBed.createComponent(BlockWrapperComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('block', mockBlock);
		fixture.componentRef.setInput('blockIndex', 2);
		fixture.componentRef.setInput('blockConfig', mockBlockConfig);
		fixture.componentRef.setInput('blockLabel', 'Hero Section');
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	describe('inputs', () => {
		it('should read required inputs', () => {
			expect(component.block()).toBe(mockBlock);
			expect(component.blockIndex()).toBe(2);
			expect(component.blockLabel()).toBe('Hero Section');
		});

		it('should have default values for optional inputs', () => {
			expect(component.isSelected()).toBe(false);
			expect(component.isHovered()).toBe(false);
			expect(component.isDisabled()).toBe(false);
			expect(component.isCollapsed()).toBe(false);
			expect(component.canMoveUp()).toBe(true);
			expect(component.canMoveDown()).toBe(true);
			expect(component.canDelete()).toBe(true);
			expect(component.mode()).toBe('edit');
			expect(component.path()).toBe('');
		});
	});

	describe('visibleFields', () => {
		it('should filter out hidden fields', () => {
			const visible = component.visibleFields();
			expect(visible).toHaveLength(2);
			expect(visible.map((f) => f.name)).toEqual(['title', 'subtitle']);
		});
	});

	describe('blockAriaLabel', () => {
		it('should return label with 1-based position', () => {
			expect(component.blockAriaLabel()).toBe('Hero Section block, position 3');
		});

		it('should update when blockIndex changes', () => {
			fixture.componentRef.setInput('blockIndex', 0);
			expect(component.blockAriaLabel()).toBe('Hero Section block, position 1');
		});
	});

	describe('getBlockSubFieldPath', () => {
		it('should build correct path', () => {
			fixture.componentRef.setInput('path', 'content');
			expect(component.getBlockSubFieldPath('title')).toBe('content.2.title');
		});

		it('should work with empty path', () => {
			expect(component.getBlockSubFieldPath('title')).toBe('.2.title');
		});
	});

	describe('getBlockSubNode', () => {
		it('should not throw for null formNode', () => {
			expect(() => component.getBlockSubNode('title')).not.toThrow();
		});
	});

	describe('outputs', () => {
		it('should have all expected output refs', () => {
			expect(component.selected).toBeDefined();
			expect(component.moveUp).toBeDefined();
			expect(component.moveDown).toBeDefined();
			expect(component.deleteBlock).toBeDefined();
			expect(component.toggleCollapse).toBeDefined();
			expect(component.hoverStart).toBeDefined();
			expect(component.hoverEnd).toBeDefined();
		});
	});
});
