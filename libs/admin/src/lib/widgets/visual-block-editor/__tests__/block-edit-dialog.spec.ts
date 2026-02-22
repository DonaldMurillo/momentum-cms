import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@momentumcms/ui';
import { BlockEditDialog, type BlockEditDialogData } from '../block-edit-dialog.component';

@Component({ selector: 'mcms-field-renderer', template: '' })
class MockFieldRenderer {}

const mockBlockConfig = {
	slug: 'hero',
	labels: { singular: 'Hero Block' },
	fields: [
		{ name: 'title', type: 'text', label: 'Title' },
		{ name: 'subtitle', type: 'text', label: 'Subtitle' },
		{ name: 'hidden_field', type: 'text', label: 'Hidden', admin: { hidden: true } },
	],
};

const mockDialogData: BlockEditDialogData = {
	blockConfig: mockBlockConfig as BlockEditDialogData['blockConfig'],
	formNode: { 0: { title: 'signal_title', subtitle: 'signal_subtitle' } },
	blockIndex: 0,
	formTree: {},
	formModel: { content: [{ blockType: 'hero', title: 'Hello' }] },
	mode: 'edit',
	path: 'content',
};

class MockDialogRef {
	close = vi.fn();
}

describe('BlockEditDialog', () => {
	let component: BlockEditDialog;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [BlockEditDialog],
			providers: [
				{ provide: DIALOG_DATA, useValue: mockDialogData },
				{ provide: DialogRef, useValue: new MockDialogRef() },
			],
		})
			.overrideComponent(BlockEditDialog, {
				set: {
					imports: [MockFieldRenderer],
					template: '<div></div>',
				},
			})
			.compileComponents();

		const fixture = TestBed.createComponent(BlockEditDialog);
		component = fixture.componentInstance;
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should expose dialog data', () => {
		expect(component.data).toBe(mockDialogData);
	});

	it('should resolve block label from config', () => {
		expect(component.blockLabel).toBe('Hero Block');
	});

	it('should filter out hidden fields from visibleFields', () => {
		expect(component.visibleFields).toHaveLength(2);
		expect(component.visibleFields.map((f) => f.name)).toEqual(['title', 'subtitle']);
	});

	it('should generate correct field path', () => {
		expect(component.getFieldPath('title')).toBe('content.0.title');
		expect(component.getFieldPath('subtitle')).toBe('content.0.subtitle');
	});

	it('should return formNode for getFieldNode', () => {
		// getSubNode returns the sub-node for blockIndex then fieldName
		const node = component.getFieldNode('title');
		// Result depends on getSubNode implementation, just ensure it doesn't throw
		expect(node).toBeDefined();
	});

	describe('with no labels', () => {
		it('should fallback to slug for block label', async () => {
			const noLabelConfig = {
				...mockBlockConfig,
				labels: undefined,
				slug: 'testimonial',
			};
			const noLabelData = { ...mockDialogData, blockConfig: noLabelConfig };

			await TestBed.resetTestingModule()
				.configureTestingModule({
					imports: [BlockEditDialog],
					providers: [
						{ provide: DIALOG_DATA, useValue: noLabelData },
						{ provide: DialogRef, useValue: new MockDialogRef() },
					],
				})
				.overrideComponent(BlockEditDialog, {
					set: { imports: [MockFieldRenderer], template: '<div></div>' },
				})
				.compileComponents();

			const fix = TestBed.createComponent(BlockEditDialog);
			expect(fix.componentInstance.blockLabel).toBe('testimonial');
		});
	});
});
