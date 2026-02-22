import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollapsibleFieldRenderer } from '../collapsible-field.component';
import { createMockField } from './test-helpers';

describe('CollapsibleFieldRenderer', () => {
	let fixture: ComponentFixture<CollapsibleFieldRenderer>;
	let component: CollapsibleFieldRenderer;

	function setup(fieldOverrides: Record<string, unknown> = {}, path = 'mySection'): void {
		TestBed.configureTestingModule({
			imports: [CollapsibleFieldRenderer],
		}).compileComponents();

		fixture = TestBed.createComponent(CollapsibleFieldRenderer);
		component = fixture.componentInstance;
		fixture.componentRef.setInput(
			'field',
			createMockField('collapsible', {
				fields: [
					createMockField('text', { name: 'title', label: 'Title' }),
					createMockField('text', { name: 'subtitle', label: 'Subtitle' }),
				],
				...fieldOverrides,
			}),
		);
		fixture.componentRef.setInput('path', path);
		fixture.detectChanges();
	}

	it('should create the component', () => {
		setup();
		expect(component).toBeTruthy();
	});

	describe('panelId', () => {
		it('should generate panelId from path', () => {
			setup({}, 'mySection');
			expect(component.panelId()).toBe('collapsible-mySection');
		});

		it('should replace dots with dashes', () => {
			setup({}, 'parent.child.field');
			expect(component.panelId()).toBe('collapsible-parent-child-field');
		});
	});

	describe('label', () => {
		it('should use field label when provided', () => {
			setup({ label: 'My Section' });
			expect(component.label()).toBe('My Section');
		});

		it('should humanize field name when no label', () => {
			setup({ label: '', name: 'advancedSettings' });
			expect(component.label()).toBe('Advanced Settings');
		});
	});

	describe('description', () => {
		it('should return description', () => {
			setup({ description: 'Configure advanced options' });
			expect(component.description()).toBe('Configure advanced options');
		});

		it('should return empty string when no description', () => {
			setup({ description: undefined });
			expect(component.description()).toBe('');
		});
	});

	describe('subFields', () => {
		it('should return sub-fields for collapsible type', () => {
			setup();
			const fields = component.subFields();
			expect(fields).toHaveLength(2);
			expect(fields[0].name).toBe('title');
			expect(fields[1].name).toBe('subtitle');
		});

		it('should filter hidden sub-fields', () => {
			setup({
				fields: [
					createMockField('text', { name: 'title', label: 'Title' }),
					createMockField('text', { name: 'hidden', label: 'Hidden', admin: { hidden: true } }),
					createMockField('text', { name: 'subtitle', label: 'Subtitle' }),
				],
			});
			const fields = component.subFields();
			expect(fields).toHaveLength(2);
			expect(fields[0].name).toBe('title');
			expect(fields[1].name).toBe('subtitle');
		});

		it('should return empty array for non-collapsible type', () => {
			TestBed.configureTestingModule({
				imports: [CollapsibleFieldRenderer],
			}).compileComponents();

			fixture = TestBed.createComponent(CollapsibleFieldRenderer);
			component = fixture.componentInstance;
			fixture.componentRef.setInput('field', createMockField('text', { name: 'plainText' }));
			fixture.componentRef.setInput('path', 'plainText');
			fixture.detectChanges();

			expect(component.subFields()).toEqual([]);
		});
	});

	describe('isExpanded', () => {
		it('should default to false', () => {
			setup();
			expect(component.isExpanded()).toBe(false);
		});

		it('should be true when defaultOpen is true', () => {
			setup({ defaultOpen: true });
			expect(component.isExpanded()).toBe(true);
		});
	});

	describe('getChildFormNode', () => {
		it('should return sub-node from formTree', () => {
			TestBed.configureTestingModule({
				imports: [CollapsibleFieldRenderer],
			}).compileComponents();

			fixture = TestBed.createComponent(CollapsibleFieldRenderer);
			component = fixture.componentInstance;
			fixture.componentRef.setInput(
				'field',
				createMockField('collapsible', {
					fields: [createMockField('text', { name: 'title', label: 'Title' })],
				}),
			);
			fixture.componentRef.setInput('path', 'mySection');
			fixture.componentRef.setInput('formTree', { title: 'title-node' });
			fixture.detectChanges();

			expect(component.getChildFormNode('title')).toBe('title-node');
		});
	});
});
