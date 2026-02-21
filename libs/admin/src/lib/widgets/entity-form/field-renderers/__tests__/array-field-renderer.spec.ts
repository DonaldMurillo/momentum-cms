import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ArrayFieldRenderer } from '../array-field.component';
import { createMockFieldNodeState, createMockField } from './test-helpers';

describe('ArrayFieldRenderer', () => {
	let fixture: ComponentFixture<ArrayFieldRenderer>;
	let component: ArrayFieldRenderer;

	function setup(
		fieldOverrides: Record<string, unknown> = {},
		initialValue: unknown = [],
	): ReturnType<typeof createMockFieldNodeState> {
		const mock = createMockFieldNodeState(initialValue);
		TestBed.configureTestingModule({
			imports: [ArrayFieldRenderer],
		}).compileComponents();

		fixture = TestBed.createComponent(ArrayFieldRenderer);
		component = fixture.componentInstance;
		fixture.componentRef.setInput(
			'field',
			createMockField('array', {
				fields: [
					createMockField('text', { name: 'title', label: 'Title' }),
					createMockField('text', { name: 'description', label: 'Description' }),
				],
				...fieldOverrides,
			}),
		);
		fixture.componentRef.setInput('path', 'features');
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
			setup({ label: 'Feature List' });
			expect(component.label()).toBe('Feature List');
		});

		it('should humanize field name when no label', () => {
			setup({ label: '', name: 'featureItems' });
			expect(component.label()).toBe('Feature Items');
		});
	});

	describe('subFields', () => {
		it('should return sub-fields for array type', () => {
			setup();
			const fields = component.subFields();
			expect(fields).toHaveLength(2);
			expect(fields[0].name).toBe('title');
			expect(fields[1].name).toBe('description');
		});

		it('should filter hidden sub-fields', () => {
			setup({
				fields: [
					createMockField('text', { name: 'title', label: 'Title' }),
					createMockField('text', {
						name: 'hidden',
						label: 'Hidden',
						admin: { hidden: true },
					}),
					createMockField('text', { name: 'description', label: 'Description' }),
				],
			});
			const fields = component.subFields();
			expect(fields).toHaveLength(2);
			expect(fields[0].name).toBe('title');
			expect(fields[1].name).toBe('description');
		});

		it('should return empty array for non-array type', () => {
			TestBed.configureTestingModule({
				imports: [ArrayFieldRenderer],
			}).compileComponents();

			fixture = TestBed.createComponent(ArrayFieldRenderer);
			component = fixture.componentInstance;
			fixture.componentRef.setInput('field', createMockField('text', { name: 'plainText' }));
			fixture.componentRef.setInput('path', 'plainText');
			fixture.detectChanges();

			expect(component.subFields()).toEqual([]);
		});
	});

	describe('minRows', () => {
		it('should return minRows from field config', () => {
			setup({ minRows: 2 });
			expect(component.minRows()).toBe(2);
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

	describe('rows', () => {
		it('should return array from state value', () => {
			setup({}, [
				{ title: 'First', description: 'Desc 1' },
				{ title: 'Second', description: 'Desc 2' },
			]);
			const rows = component.rows();
			expect(rows).toHaveLength(2);
			expect(rows[0]).toEqual({ title: 'First', description: 'Desc 1' });
			expect(rows[1]).toEqual({ title: 'Second', description: 'Desc 2' });
		});

		it('should return empty array when no state', () => {
			TestBed.configureTestingModule({
				imports: [ArrayFieldRenderer],
			}).compileComponents();

			fixture = TestBed.createComponent(ArrayFieldRenderer);
			component = fixture.componentInstance;
			fixture.componentRef.setInput(
				'field',
				createMockField('array', {
					fields: [createMockField('text', { name: 'title', label: 'Title' })],
				}),
			);
			fixture.componentRef.setInput('path', 'features');
			// formNode defaults to null — no state
			fixture.detectChanges();

			expect(component.rows()).toEqual([]);
		});

		it('should handle non-record items by converting to empty objects', () => {
			setup({}, ['not-an-object', 42, { title: 'Valid' }]);
			const rows = component.rows();
			expect(rows).toHaveLength(3);
			expect(rows[0]).toEqual({});
			expect(rows[1]).toEqual({});
			expect(rows[2]).toEqual({ title: 'Valid' });
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

	describe('canAddRow', () => {
		it('should be true when under max', () => {
			setup({ maxRows: 5 }, [{ title: 'One' }]);
			expect(component.canAddRow()).toBe(true);
		});

		it('should be true when no max is set', () => {
			setup({}, [{ title: 'One' }]);
			expect(component.canAddRow()).toBe(true);
		});

		it('should be false when at max', () => {
			setup({ maxRows: 2 }, [{ title: 'One' }, { title: 'Two' }]);
			expect(component.canAddRow()).toBe(false);
		});

		it('should be false when disabled', () => {
			setup({ maxRows: 5 }, [{ title: 'One' }]);
			fixture.componentRef.setInput('mode', 'view');
			fixture.detectChanges();
			expect(component.canAddRow()).toBe(false);
		});
	});

	describe('canRemoveRow', () => {
		it('should be true when above min', () => {
			setup({ minRows: 0 }, [{ title: 'One' }, { title: 'Two' }]);
			expect(component.canRemoveRow()).toBe(true);
		});

		it('should be false at min', () => {
			setup({ minRows: 1 }, [{ title: 'One' }]);
			expect(component.canRemoveRow()).toBe(false);
		});

		it('should be false when disabled', () => {
			setup({ minRows: 0 }, [{ title: 'One' }]);
			fixture.componentRef.setInput('mode', 'view');
			fixture.detectChanges();
			expect(component.canRemoveRow()).toBe(false);
		});
	});

	describe('getRowSubFieldPath', () => {
		it('should build correct path', () => {
			setup();
			expect(component.getRowSubFieldPath(0, 'title')).toBe('features.0.title');
			expect(component.getRowSubFieldPath(2, 'description')).toBe('features.2.description');
		});
	});

	describe('addRow', () => {
		it('should add a new row with default values for each sub-field', () => {
			const mock = setup({}, [{ title: 'Existing', description: 'Row' }]);
			component.addRow();

			const updatedRows = mock.state.value() as Record<string, unknown>[];
			expect(updatedRows).toHaveLength(2);
			expect(updatedRows[0]).toEqual({ title: 'Existing', description: 'Row' });
			expect(updatedRows[1]).toEqual({ title: '', description: '' });
		});

		it('should do nothing when no state', () => {
			TestBed.configureTestingModule({
				imports: [ArrayFieldRenderer],
			}).compileComponents();

			fixture = TestBed.createComponent(ArrayFieldRenderer);
			component = fixture.componentInstance;
			fixture.componentRef.setInput(
				'field',
				createMockField('array', {
					fields: [createMockField('text', { name: 'title', label: 'Title' })],
				}),
			);
			fixture.componentRef.setInput('path', 'features');
			fixture.detectChanges();

			// Should not throw when formNode is null
			expect(() => component.addRow()).not.toThrow();
		});
	});

	describe('removeRow', () => {
		it('should remove row at index', () => {
			const mock = setup({}, [
				{ title: 'First', description: 'A' },
				{ title: 'Second', description: 'B' },
				{ title: 'Third', description: 'C' },
			]);
			component.removeRow(1);

			const updatedRows = mock.state.value() as Record<string, unknown>[];
			expect(updatedRows).toHaveLength(2);
			expect(updatedRows[0]).toEqual({ title: 'First', description: 'A' });
			expect(updatedRows[1]).toEqual({ title: 'Third', description: 'C' });
		});

		it('should do nothing when no state', () => {
			TestBed.configureTestingModule({
				imports: [ArrayFieldRenderer],
			}).compileComponents();

			fixture = TestBed.createComponent(ArrayFieldRenderer);
			component = fixture.componentInstance;
			fixture.componentRef.setInput(
				'field',
				createMockField('array', {
					fields: [createMockField('text', { name: 'title', label: 'Title' })],
				}),
			);
			fixture.componentRef.setInput('path', 'features');
			fixture.detectChanges();

			// Should not throw when formNode is null
			expect(() => component.removeRow(0)).not.toThrow();
		});
	});
});
