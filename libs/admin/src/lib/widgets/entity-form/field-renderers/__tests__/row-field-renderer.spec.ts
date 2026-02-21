import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RowFieldRenderer } from '../row-field.component';
import { createMockField } from './test-helpers';

describe('RowFieldRenderer', () => {
	let fixture: ComponentFixture<RowFieldRenderer>;
	let component: RowFieldRenderer;

	function setup(fieldOverrides: Record<string, unknown> = {}): void {
		TestBed.configureTestingModule({
			imports: [RowFieldRenderer],
		}).compileComponents();

		fixture = TestBed.createComponent(RowFieldRenderer);
		component = fixture.componentInstance;
		fixture.componentRef.setInput(
			'field',
			createMockField('row', {
				fields: [
					createMockField('text', { name: 'firstName', label: 'First Name' }),
					createMockField('text', { name: 'lastName', label: 'Last Name' }),
				],
				...fieldOverrides,
			}),
		);
		fixture.componentRef.setInput('path', 'nameRow');
		fixture.detectChanges();
	}

	it('should create the component', () => {
		setup();
		expect(component).toBeTruthy();
	});

	describe('label', () => {
		it('should return field label', () => {
			setup({ label: 'Full Name' });
			expect(component.label()).toBe('Full Name');
		});

		it('should return empty string when no label', () => {
			setup({ label: '' });
			expect(component.label()).toBe('');
		});
	});

	describe('description', () => {
		it('should return description', () => {
			setup({ description: 'Enter your full name' });
			expect(component.description()).toBe('Enter your full name');
		});
	});

	describe('subFields', () => {
		it('should return sub-fields for row type', () => {
			setup();
			const fields = component.subFields();
			expect(fields).toHaveLength(2);
			expect(fields[0].name).toBe('firstName');
			expect(fields[1].name).toBe('lastName');
		});

		it('should filter hidden sub-fields', () => {
			setup({
				fields: [
					createMockField('text', { name: 'firstName', label: 'First Name' }),
					createMockField('text', {
						name: 'hidden',
						label: 'Hidden',
						admin: { hidden: true },
					}),
					createMockField('text', { name: 'lastName', label: 'Last Name' }),
				],
			});
			const fields = component.subFields();
			expect(fields).toHaveLength(2);
			expect(fields[0].name).toBe('firstName');
			expect(fields[1].name).toBe('lastName');
		});

		it('should return empty array for non-row type', () => {
			TestBed.configureTestingModule({
				imports: [RowFieldRenderer],
			}).compileComponents();

			fixture = TestBed.createComponent(RowFieldRenderer);
			component = fixture.componentInstance;
			fixture.componentRef.setInput('field', createMockField('text', { name: 'plainText' }));
			fixture.componentRef.setInput('path', 'plainText');
			fixture.detectChanges();

			expect(component.subFields()).toEqual([]);
		});
	});

	describe('gridColumns', () => {
		it('should generate correct CSS grid columns', () => {
			setup();
			expect(component.gridColumns()).toBe('repeat(2, 1fr)');
		});

		it('should handle zero sub-fields', () => {
			TestBed.configureTestingModule({
				imports: [RowFieldRenderer],
			}).compileComponents();

			fixture = TestBed.createComponent(RowFieldRenderer);
			component = fixture.componentInstance;
			fixture.componentRef.setInput('field', createMockField('text', { name: 'notARow' }));
			fixture.componentRef.setInput('path', 'notARow');
			fixture.detectChanges();

			expect(component.gridColumns()).toBe('repeat(0, 1fr)');
		});
	});

	describe('getChildFormNode', () => {
		it('should return sub-node from formTree', () => {
			TestBed.configureTestingModule({
				imports: [RowFieldRenderer],
			}).compileComponents();

			fixture = TestBed.createComponent(RowFieldRenderer);
			component = fixture.componentInstance;
			fixture.componentRef.setInput(
				'field',
				createMockField('row', {
					fields: [createMockField('text', { name: 'firstName', label: 'First Name' })],
				}),
			);
			fixture.componentRef.setInput('path', 'nameRow');
			fixture.componentRef.setInput('formTree', { firstName: 'first-name-node' });
			fixture.detectChanges();

			expect(component.getChildFormNode('firstName')).toBe('first-name-node');
		});
	});
});
