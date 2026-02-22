import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import type { Field } from '@momentumcms/core';
import { RelationshipFieldRenderer } from '../relationship-field.component';
import { EntitySheetService } from '../../../../services/entity-sheet.service';
import { Subject } from 'rxjs';

function createMockNodeState(initialValue: unknown = null): {
	value: ReturnType<typeof signal>;
	errors: ReturnType<typeof signal>;
	touched: ReturnType<typeof signal>;
	dirty: ReturnType<typeof signal>;
	invalid: ReturnType<typeof signal>;
	markAsTouched: ReturnType<typeof vi.fn>;
	reset: ReturnType<typeof vi.fn>;
} {
	return {
		value: signal(initialValue),
		errors: signal([]),
		touched: signal(false),
		dirty: signal(false),
		invalid: signal(false),
		markAsTouched: vi.fn(),
		reset: vi.fn(),
	};
}

function createFormNode(state: ReturnType<typeof createMockNodeState>): () => typeof state {
	return () => state;
}

const mockRelatedCollection = {
	slug: 'authors',
	labels: { singular: 'Author', plural: 'Authors' },
	fields: [{ name: 'name', type: 'text' }],
};

function makeRelField(overrides: Record<string, unknown> = {}): Field {
	return {
		name: 'author',
		type: 'relationship',
		label: 'Author',
		collection: () => mockRelatedCollection,
		hasMany: false,
		...overrides,
	} as unknown as Field;
}

class MockEntitySheetService {
	openCreateSubject = new Subject<{ action: string; entity?: Record<string, unknown> }>();
	openViewSubject = new Subject<{ action: string }>();
	openCreate = vi.fn().mockReturnValue(this.openCreateSubject.asObservable());
	openView = vi.fn().mockReturnValue(this.openViewSubject.asObservable());
}

describe('RelationshipFieldRenderer', () => {
	let fixture: ComponentFixture<RelationshipFieldRenderer>;
	let component: RelationshipFieldRenderer;
	let httpMock: HttpTestingController;
	let mockSheetService: MockEntitySheetService;

	beforeEach(async () => {
		mockSheetService = new MockEntitySheetService();

		await TestBed.configureTestingModule({
			imports: [RelationshipFieldRenderer],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				{ provide: EntitySheetService, useValue: mockSheetService },
			],
		})
			.overrideComponent(RelationshipFieldRenderer, {
				set: { template: '<div></div>', imports: [] },
			})
			.compileComponents();

		fixture = TestBed.createComponent(RelationshipFieldRenderer);
		component = fixture.componentInstance;
		httpMock = TestBed.inject(HttpTestingController);

		fixture.componentRef.setInput('field', makeRelField());
		fixture.componentRef.setInput('path', 'author');
		fixture.detectChanges();
	});

	afterEach(() => {
		// Flush any pending auto-fetch requests from the component's effect()
		const pending = httpMock.match(() => true);
		for (const req of pending) {
			if (!req.cancelled) {
				req.flush({ docs: [] });
			}
		}
	});

	function flushOptionsRequest(docs: Record<string, unknown>[] = []): void {
		const req = httpMock.match((r) => r.url.startsWith('/api/'));
		for (const r of req) {
			if (!r.cancelled) {
				r.flush({ docs });
			}
		}
	}

	it('should create', () => {
		flushOptionsRequest();
		expect(component).toBeTruthy();
	});

	describe('fieldId', () => {
		it('should generate id from path', () => {
			flushOptionsRequest();
			expect(component.fieldId()).toBe('field-author');
		});

		it('should replace dots with dashes', () => {
			fixture.componentRef.setInput('path', 'group.author');
			flushOptionsRequest();
			expect(component.fieldId()).toBe('field-group-author');
		});
	});

	describe('label', () => {
		it('should use field label', () => {
			flushOptionsRequest();
			expect(component.label()).toBe('Author');
		});

		it('should fallback to humanized name', () => {
			fixture.componentRef.setInput(
				'field',
				makeRelField({ label: undefined, name: 'relatedAuthor' }),
			);
			flushOptionsRequest();
			expect(component.label()).toBe('Related Author');
		});
	});

	describe('required', () => {
		it('should return false by default', () => {
			flushOptionsRequest();
			expect(component.required()).toBe(false);
		});

		it('should return true when field is required', () => {
			fixture.componentRef.setInput('field', makeRelField({ required: true }));
			flushOptionsRequest();
			expect(component.required()).toBe(true);
		});
	});

	describe('isDisabled', () => {
		it('should be false for create mode', () => {
			flushOptionsRequest();
			expect(component.isDisabled()).toBe(false);
		});

		it('should be true for view mode', () => {
			fixture.componentRef.setInput('mode', 'view');
			flushOptionsRequest();
			expect(component.isDisabled()).toBe(true);
		});

		it('should be true when readOnly', () => {
			fixture.componentRef.setInput('field', makeRelField({ admin: { readOnly: true } }));
			flushOptionsRequest();
			expect(component.isDisabled()).toBe(true);
		});
	});

	describe('isMulti', () => {
		it('should be false by default', () => {
			flushOptionsRequest();
			expect(component.isMulti()).toBe(false);
		});

		it('should be true when hasMany', () => {
			fixture.componentRef.setInput('field', makeRelField({ hasMany: true }));
			flushOptionsRequest();
			expect(component.isMulti()).toBe(true);
		});

		it('should be false for non-relationship type', () => {
			fixture.componentRef.setInput('field', {
				name: 'title',
				type: 'text',
				label: 'Title',
			} as Field);
			flushOptionsRequest();
			expect(component.isMulti()).toBe(false);
		});
	});

	describe('relatedSlug', () => {
		it('should extract slug from lazy collection ref', () => {
			flushOptionsRequest();
			expect(component.relatedSlug()).toBe('authors');
		});

		it('should return empty string for non-relationship field', () => {
			fixture.componentRef.setInput('field', { name: 'title', type: 'text' } as Field);
			expect(component.relatedSlug()).toBe('');
		});
	});

	describe('titleField', () => {
		it('should use name field from related collection', () => {
			flushOptionsRequest();
			expect(component.titleField()).toBe('name');
		});

		it('should return id for non-relationship field', () => {
			fixture.componentRef.setInput('field', { name: 'title', type: 'text' } as Field);
			expect(component.titleField()).toBe('id');
		});
	});

	describe('relatedLabel', () => {
		it('should use singular label from related collection', () => {
			flushOptionsRequest();
			expect(component.relatedLabel()).toBe('Author');
		});

		it('should fallback to slug', () => {
			const noLabels = { ...mockRelatedCollection, labels: undefined };
			fixture.componentRef.setInput('field', makeRelField({ collection: () => noLabels }));
			flushOptionsRequest();
			expect(component.relatedLabel()).toBe('authors');
		});

		it('should return item for non-relationship field', () => {
			fixture.componentRef.setInput('field', { name: 'title', type: 'text' } as Field);
			expect(component.relatedLabel()).toBe('item');
		});
	});

	describe('singleValue', () => {
		it('should return empty string when no formNode', () => {
			flushOptionsRequest();
			expect(component.singleValue()).toBe('');
		});

		it('should return string value from state', () => {
			const state = createMockNodeState('author-1');
			fixture.componentRef.setInput('formNode', createFormNode(state));
			flushOptionsRequest();
			expect(component.singleValue()).toBe('author-1');
		});

		it('should extract id from populated object', () => {
			const state = createMockNodeState({ id: 'author-1', name: 'John' });
			fixture.componentRef.setInput('formNode', createFormNode(state));
			flushOptionsRequest();
			expect(component.singleValue()).toBe('author-1');
		});

		it('should return empty string for non-string non-object value', () => {
			const state = createMockNodeState(42);
			fixture.componentRef.setInput('formNode', createFormNode(state));
			flushOptionsRequest();
			expect(component.singleValue()).toBe('');
		});
	});

	describe('multiValues', () => {
		it('should return empty array when no formNode', () => {
			flushOptionsRequest();
			expect(component.multiValues()).toEqual([]);
		});

		it('should return array of string values', () => {
			const state = createMockNodeState(['a1', 'a2']);
			fixture.componentRef.setInput('formNode', createFormNode(state));
			flushOptionsRequest();
			expect(component.multiValues()).toEqual(['a1', 'a2']);
		});

		it('should extract ids from populated objects', () => {
			const state = createMockNodeState([
				{ id: 'a1', name: 'John' },
				{ id: 'a2', name: 'Jane' },
			]);
			fixture.componentRef.setInput('formNode', createFormNode(state));
			flushOptionsRequest();
			expect(component.multiValues()).toEqual(['a1', 'a2']);
		});

		it('should return empty array when not array', () => {
			const state = createMockNodeState('not-array');
			fixture.componentRef.setInput('formNode', createFormNode(state));
			flushOptionsRequest();
			expect(component.multiValues()).toEqual([]);
		});

		it('should filter out empty values', () => {
			const state = createMockNodeState(['a1', null, 'a2']);
			fixture.componentRef.setInput('formNode', createFormNode(state));
			flushOptionsRequest();
			expect(component.multiValues()).toEqual(['a1', 'a2']);
		});
	});

	describe('selectedOptions', () => {
		it('should resolve multi values to option labels', () => {
			const state = createMockNodeState(['a1']);
			fixture.componentRef.setInput('formNode', createFormNode(state));
			fixture.componentRef.setInput('field', makeRelField({ hasMany: true }));
			fixture.detectChanges();
			flushOptionsRequest();
			// Set allOptions AFTER flushing the auto-fetch to prevent being overwritten
			component.allOptions.set([
				{ value: 'a1', label: 'John' },
				{ value: 'a2', label: 'Jane' },
			]);

			expect(component.selectedOptions()).toEqual([{ value: 'a1', label: 'John' }]);
		});

		it('should skip unknown values', () => {
			const state = createMockNodeState(['unknown-id']);
			fixture.componentRef.setInput('formNode', createFormNode(state));
			fixture.detectChanges();
			flushOptionsRequest();
			component.allOptions.set([{ value: 'a1', label: 'John' }]);

			expect(component.selectedOptions()).toEqual([]);
		});
	});

	describe('availableOptions', () => {
		it('should exclude already selected options', () => {
			const state = createMockNodeState(['a1']);
			fixture.componentRef.setInput('formNode', createFormNode(state));
			fixture.componentRef.setInput('field', makeRelField({ hasMany: true }));
			fixture.detectChanges();
			flushOptionsRequest();
			component.allOptions.set([
				{ value: 'a1', label: 'John' },
				{ value: 'a2', label: 'Jane' },
			]);

			expect(component.availableOptions()).toEqual([{ value: 'a2', label: 'Jane' }]);
		});
	});

	describe('touchedErrors', () => {
		it('should return empty array when no formNode', () => {
			flushOptionsRequest();
			expect(component.touchedErrors()).toEqual([]);
		});

		it('should return empty when not touched', () => {
			const state = createMockNodeState();
			state.errors.set([{ kind: 'required', message: 'Required' }]);
			fixture.componentRef.setInput('formNode', createFormNode(state));
			flushOptionsRequest();
			expect(component.touchedErrors()).toEqual([]);
		});

		it('should return errors when touched', () => {
			const state = createMockNodeState();
			state.errors.set([{ kind: 'required', message: 'Required' }]);
			state.touched.set(true);
			fixture.componentRef.setInput('formNode', createFormNode(state));
			flushOptionsRequest();
			expect(component.touchedErrors()).toEqual([{ kind: 'required', message: 'Required' }]);
		});
	});

	describe('hasSelection', () => {
		it('should return false when no selection', () => {
			flushOptionsRequest();
			expect(component.hasSelection()).toBe(false);
		});

		it('should return true when single value set', () => {
			const state = createMockNodeState('a1');
			fixture.componentRef.setInput('formNode', createFormNode(state));
			flushOptionsRequest();
			expect(component.hasSelection()).toBe(true);
		});

		it('should return true when multi values set', () => {
			const state = createMockNodeState(['a1']);
			fixture.componentRef.setInput('formNode', createFormNode(state));
			fixture.componentRef.setInput('field', makeRelField({ hasMany: true }));
			flushOptionsRequest();
			expect(component.hasSelection()).toBe(true);
		});
	});

	describe('onSingleSelect', () => {
		function makeSelectEvent(value: string): Event {
			const select = document.createElement('select');
			const option = document.createElement('option');
			option.value = value;
			select.appendChild(option);
			const emptyOption = document.createElement('option');
			emptyOption.value = '';
			select.appendChild(emptyOption);
			select.value = value;
			const event = new Event('change');
			Object.defineProperty(event, 'target', { value: select });
			return event;
		}

		it('should set value on form state', () => {
			const state = createMockNodeState('');
			fixture.componentRef.setInput('formNode', createFormNode(state));
			fixture.detectChanges();
			flushOptionsRequest();

			component.onSingleSelect(makeSelectEvent('a1'));
			expect(state.value()).toBe('a1');
		});

		it('should set null for empty value', () => {
			const state = createMockNodeState('a1');
			fixture.componentRef.setInput('formNode', createFormNode(state));
			fixture.detectChanges();
			flushOptionsRequest();

			component.onSingleSelect(makeSelectEvent(''));
			expect(state.value()).toBeNull();
		});

		it('should ignore non-select target', () => {
			flushOptionsRequest();
			const event = new Event('change');
			expect(() => component.onSingleSelect(event)).not.toThrow();
		});
	});

	describe('onMultiSelect', () => {
		function makeSelectEvent(value: string): Event {
			const select = document.createElement('select');
			const option = document.createElement('option');
			option.value = value;
			select.appendChild(option);
			const emptyOption = document.createElement('option');
			emptyOption.value = '';
			select.appendChild(emptyOption);
			select.value = value;
			const event = new Event('change');
			Object.defineProperty(event, 'target', { value: select });
			return event;
		}

		it('should add value to multi selection', () => {
			const state = createMockNodeState(['a1']);
			fixture.componentRef.setInput('formNode', createFormNode(state));
			fixture.componentRef.setInput('field', makeRelField({ hasMany: true }));
			fixture.detectChanges();
			flushOptionsRequest();

			component.onMultiSelect(makeSelectEvent('a2'));
			expect(state.value()).toEqual(['a1', 'a2']);
		});

		it('should not add duplicate value', () => {
			const state = createMockNodeState(['a1']);
			fixture.componentRef.setInput('formNode', createFormNode(state));
			fixture.componentRef.setInput('field', makeRelField({ hasMany: true }));
			fixture.detectChanges();
			flushOptionsRequest();

			component.onMultiSelect(makeSelectEvent('a1'));
			expect(state.value()).toEqual(['a1']);
		});

		it('should ignore empty value', () => {
			const state = createMockNodeState([]);
			fixture.componentRef.setInput('formNode', createFormNode(state));
			flushOptionsRequest();

			component.onMultiSelect(makeSelectEvent(''));
			expect(state.value()).toEqual([]);
		});

		it('should ignore non-select target', () => {
			flushOptionsRequest();
			const event = new Event('change');
			expect(() => component.onMultiSelect(event)).not.toThrow();
		});
	});

	describe('removeSelection', () => {
		it('should remove value from multi selection', () => {
			const state = createMockNodeState(['a1', 'a2']);
			fixture.componentRef.setInput('formNode', createFormNode(state));
			flushOptionsRequest();

			component.removeSelection('a1');
			expect(state.value()).toEqual(['a2']);
		});

		it('should not throw when no formNode', () => {
			flushOptionsRequest();
			expect(() => component.removeSelection('a1')).not.toThrow();
		});
	});

	describe('onBlur', () => {
		it('should mark as touched', () => {
			const state = createMockNodeState();
			fixture.componentRef.setInput('formNode', createFormNode(state));
			flushOptionsRequest();

			component.onBlur();
			expect(state.markAsTouched).toHaveBeenCalled();
		});

		it('should not throw when no formNode', () => {
			flushOptionsRequest();
			expect(() => component.onBlur()).not.toThrow();
		});
	});

	describe('fetchOptions', () => {
		it('should load options from API', () => {
			// Flush any auto-fetch requests first
			flushOptionsRequest();

			const sub = component.fetchOptions('authors');
			const req = httpMock.match((r) => r.url === '/api/authors');
			for (const r of req) {
				r.flush({
					docs: [
						{ id: 'a1', name: 'John' },
						{ id: 'a2', name: 'Jane' },
					],
				});
			}

			expect(component.allOptions()).toEqual([
				{ value: 'a1', label: 'John' },
				{ value: 'a2', label: 'Jane' },
			]);
			expect(component.isLoading()).toBe(false);
			sub.unsubscribe();
		});

		it('should handle API error', () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
				/* noop */
			});
			const sub = component.fetchOptions('authors');
			const req = httpMock.match((r) => r.url === '/api/authors');
			const latestReq = req[req.length - 1];
			latestReq.error(new ProgressEvent('error'));
			for (let i = 0; i < req.length - 1; i++) {
				req[i].flush({ docs: [] });
			}

			expect(component.allOptions()).toEqual([]);
			expect(component.isLoading()).toBe(false);
			consoleSpy.mockRestore();
			sub.unsubscribe();
		});

		it('should use id as label when titleField is id', () => {
			const noTitleCol = { slug: 'tags', fields: [] };
			fixture.componentRef.setInput('field', makeRelField({ collection: () => noTitleCol }));
			flushOptionsRequest();

			const sub = component.fetchOptions('tags');
			const req = httpMock.match((r) => r.url === '/api/tags');
			const latestReq = req[req.length - 1];
			latestReq.flush({ docs: [{ id: 'tag-1' }] });
			for (let i = 0; i < req.length - 1; i++) {
				req[i].flush({ docs: [] });
			}

			expect(component.allOptions()).toEqual([{ value: 'tag-1', label: 'tag-1' }]);
			sub.unsubscribe();
		});

		it('should handle missing docs in response', () => {
			const sub = component.fetchOptions('authors');
			const req = httpMock.match((r) => r.url === '/api/authors');
			const latestReq = req[req.length - 1];
			latestReq.flush({});
			for (let i = 0; i < req.length - 1; i++) {
				req[i].flush({ docs: [] });
			}

			expect(component.allOptions()).toEqual([]);
			sub.unsubscribe();
		});
	});

	describe('onCreateRelated', () => {
		it('should open entity sheet for create', () => {
			flushOptionsRequest();
			component.onCreateRelated();
			expect(mockSheetService.openCreate).toHaveBeenCalledWith('authors');
		});

		it('should add created entity to single value', () => {
			const state = createMockNodeState(null);
			fixture.componentRef.setInput('formNode', createFormNode(state));
			flushOptionsRequest();

			component.onCreateRelated();
			mockSheetService.openCreateSubject.next({
				action: 'created',
				entity: { id: 'new-1', name: 'New Author' },
			});

			httpMock.match((r) => r.url === '/api/authors').forEach((r) => r.flush({ docs: [] }));

			expect(state.value()).toBe('new-1');
		});

		it('should add created entity to multi values', () => {
			const state = createMockNodeState(['a1']);
			fixture.componentRef.setInput('formNode', createFormNode(state));
			fixture.componentRef.setInput('field', makeRelField({ hasMany: true }));
			flushOptionsRequest();

			component.onCreateRelated();
			mockSheetService.openCreateSubject.next({
				action: 'created',
				entity: { id: 'new-1', name: 'New Author' },
			});

			httpMock.match((r) => r.url === '/api/authors').forEach((r) => r.flush({ docs: [] }));

			expect(state.value()).toEqual(['a1', 'new-1']);
		});

		it('should not call when slug is empty', () => {
			fixture.componentRef.setInput('field', { name: 'title', type: 'text' } as Field);
			component.onCreateRelated();
			expect(mockSheetService.openCreate).not.toHaveBeenCalled();
		});
	});

	describe('onViewRelated', () => {
		it('should open entity sheet for view', () => {
			const state = createMockNodeState('a1');
			fixture.componentRef.setInput('formNode', createFormNode(state));
			flushOptionsRequest();

			component.onViewRelated();
			expect(mockSheetService.openView).toHaveBeenCalledWith('authors', 'a1');
		});

		it('should clear single value when entity deleted', () => {
			const state = createMockNodeState('a1');
			fixture.componentRef.setInput('formNode', createFormNode(state));
			flushOptionsRequest();

			component.onViewRelated();
			mockSheetService.openViewSubject.next({ action: 'deleted' });

			httpMock.match((r) => r.url === '/api/authors').forEach((r) => r.flush({ docs: [] }));

			expect(state.value()).toBeNull();
		});

		it('should remove deleted entity from multi values', () => {
			const state = createMockNodeState(['a1', 'a2']);
			fixture.componentRef.setInput('formNode', createFormNode(state));
			fixture.componentRef.setInput('field', makeRelField({ hasMany: true }));
			flushOptionsRequest();

			component.onViewRelated();
			mockSheetService.openViewSubject.next({ action: 'deleted' });

			httpMock.match((r) => r.url === '/api/authors').forEach((r) => r.flush({ docs: [] }));

			expect(state.value()).toEqual(['a2']);
		});

		it('should not call when no selection', () => {
			flushOptionsRequest();
			component.onViewRelated();
			expect(mockSheetService.openView).not.toHaveBeenCalled();
		});
	});
});
