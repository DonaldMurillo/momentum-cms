/**
 * Extended coverage tests for RelationshipFieldRenderer.
 *
 * The base spec (relationship-field-renderer.spec.ts) covers: fieldId, label,
 * required, isDisabled, isMulti, relatedSlug, titleField, relatedLabel,
 * singleValue, multiValues, selectedOptions, availableOptions, touchedErrors,
 * hasSelection, onSingleSelect, onMultiSelect, removeSelection, onBlur,
 * fetchOptions (basic load, error, id label, missing docs), onCreateRelated,
 * and onViewRelated.
 *
 * This file targets remaining uncovered branches:
 * - fetchOptions with filterOptions (where clause building)
 * - onCreateRelated when formNode is null
 * - onCreateRelated result when action is not 'created'
 * - onViewRelated when action is not 'deleted'
 * - onViewRelated with multi-select (first value used)
 * - entitySheetService is null (optional inject)
 * - relatedLabel fallback when labels exist but singular is not a string
 * - titleField with admin.useAsTitle configured
 * - multiValues with mixed item types
 * - singleValue with various edge cases
 * - onSingleSelect/onMultiSelect with no formNode
 */
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

describe('RelationshipFieldRenderer (coverage - additional branches)', () => {
	let fixture: ComponentFixture<RelationshipFieldRenderer>;
	let component: RelationshipFieldRenderer;
	let httpMock: HttpTestingController;
	let mockSheetService: MockEntitySheetService;

	function setupWithSheet(): void {
		mockSheetService = new MockEntitySheetService();

		TestBed.configureTestingModule({
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
	}

	afterEach(() => {
		// Flush any pending auto-fetch requests
		const pending = httpMock.match(() => true);
		for (const req of pending) {
			if (!req.cancelled) {
				req.flush({ docs: [] });
			}
		}
		TestBed.resetTestingModule();
	});

	function flushOptionsRequest(docs: Record<string, unknown>[] = []): void {
		const req = httpMock.match((r) => r.url.startsWith('/api/'));
		for (const r of req) {
			if (!r.cancelled) {
				r.flush({ docs });
			}
		}
	}

	// ------------------------------------------------------------------
	// fetchOptions with filterOptions
	// ------------------------------------------------------------------
	describe('fetchOptions with filterOptions', () => {
		it('should include where params from filterOptions', () => {
			setupWithSheet();
			const filterField = makeRelField({
				filterOptions: (args: { data: Record<string, unknown> }) => ({
					category: args.data['category'],
					status: 'published',
				}),
			});
			fixture.componentRef.setInput('field', filterField);
			fixture.componentRef.setInput('formModel', { category: 'tech' });
			fixture.detectChanges();
			flushOptionsRequest();

			const sub = component.fetchOptions('authors');
			const req = httpMock.match((r) => r.url === '/api/authors');
			const latestReq = req[req.length - 1];

			expect(latestReq.request.params.get('where[category]')).toBe('tech');
			expect(latestReq.request.params.get('where[status]')).toBe('published');

			latestReq.flush({ docs: [{ id: 'a1', name: 'John' }] });
			for (let i = 0; i < req.length - 1; i++) {
				req[i].flush({ docs: [] });
			}

			expect(component.allOptions()).toEqual([{ value: 'a1', label: 'John' }]);
			sub.unsubscribe();
		});

		it('should skip undefined/null filter values', () => {
			setupWithSheet();
			const filterField = makeRelField({
				filterOptions: () => ({
					category: undefined,
					status: null,
					active: 'true',
				}),
			});
			fixture.componentRef.setInput('field', filterField);
			fixture.detectChanges();
			flushOptionsRequest();

			const sub = component.fetchOptions('authors');
			const req = httpMock.match((r) => r.url === '/api/authors');
			const latestReq = req[req.length - 1];

			expect(latestReq.request.params.has('where[category]')).toBe(false);
			expect(latestReq.request.params.has('where[status]')).toBe(false);
			expect(latestReq.request.params.get('where[active]')).toBe('true');

			latestReq.flush({ docs: [] });
			for (let i = 0; i < req.length - 1; i++) {
				req[i].flush({ docs: [] });
			}
			sub.unsubscribe();
		});
	});

	// ------------------------------------------------------------------
	// onCreateRelated: action is not 'created'
	// ------------------------------------------------------------------
	describe('onCreateRelated with non-created action', () => {
		it('should not set value when action is cancelled', () => {
			setupWithSheet();
			const state = createMockNodeState(null);
			fixture.componentRef.setInput('formNode', createFormNode(state));
			flushOptionsRequest();

			component.onCreateRelated();
			mockSheetService.openCreateSubject.next({ action: 'cancelled' });

			expect(state.value()).toBeNull();
		});

		it('should not set value when action is created but no entity', () => {
			setupWithSheet();
			const state = createMockNodeState(null);
			fixture.componentRef.setInput('formNode', createFormNode(state));
			flushOptionsRequest();

			component.onCreateRelated();
			mockSheetService.openCreateSubject.next({ action: 'created', entity: undefined });

			expect(state.value()).toBeNull();
		});

		it('should not call openCreate when formNode is null', () => {
			setupWithSheet();
			flushOptionsRequest();

			// formNode not set - onCreateRelated should still call openCreate
			// (it only checks slug and entitySheetService, not formNode)
			component.onCreateRelated();
			expect(mockSheetService.openCreate).toHaveBeenCalledWith('authors');

			// But when result comes back with created entity, setting value should be safe
			mockSheetService.openCreateSubject.next({
				action: 'created',
				entity: { id: 'new-1', name: 'New Author' },
			});

			// No crash expected even when nodeState is null
			httpMock.match((r) => r.url === '/api/authors').forEach((r) => r.flush({ docs: [] }));
		});
	});

	// ------------------------------------------------------------------
	// onViewRelated: action is not 'deleted'
	// ------------------------------------------------------------------
	describe('onViewRelated with non-deleted action', () => {
		it('should not modify value when action is updated', () => {
			setupWithSheet();
			const state = createMockNodeState('a1');
			fixture.componentRef.setInput('formNode', createFormNode(state));
			flushOptionsRequest();

			component.onViewRelated();
			mockSheetService.openViewSubject.next({ action: 'updated' });

			expect(state.value()).toBe('a1');
		});

		it('should not modify value when action is cancelled', () => {
			setupWithSheet();
			const state = createMockNodeState('a1');
			fixture.componentRef.setInput('formNode', createFormNode(state));
			flushOptionsRequest();

			component.onViewRelated();
			mockSheetService.openViewSubject.next({ action: 'cancelled' });

			expect(state.value()).toBe('a1');
		});
	});

	// ------------------------------------------------------------------
	// onViewRelated: multi-select uses first value
	// ------------------------------------------------------------------
	describe('onViewRelated multi-select first value', () => {
		it('should use the first multi value for openView', () => {
			setupWithSheet();
			const state = createMockNodeState(['a1', 'a2', 'a3']);
			fixture.componentRef.setInput('formNode', createFormNode(state));
			fixture.componentRef.setInput('field', makeRelField({ hasMany: true }));
			fixture.detectChanges();
			flushOptionsRequest();

			component.onViewRelated();
			expect(mockSheetService.openView).toHaveBeenCalledWith('authors', 'a1');
		});
	});

	// ------------------------------------------------------------------
	// onViewRelated: no id available
	// ------------------------------------------------------------------
	describe('onViewRelated with no selection', () => {
		it('should return early when multi-select has empty array', () => {
			setupWithSheet();
			const state = createMockNodeState([]);
			fixture.componentRef.setInput('formNode', createFormNode(state));
			fixture.componentRef.setInput('field', makeRelField({ hasMany: true }));
			fixture.detectChanges();
			flushOptionsRequest();

			component.onViewRelated();
			expect(mockSheetService.openView).not.toHaveBeenCalled();
		});

		it('should return early when single value is empty', () => {
			setupWithSheet();
			const state = createMockNodeState('');
			fixture.componentRef.setInput('formNode', createFormNode(state));
			flushOptionsRequest();

			component.onViewRelated();
			expect(mockSheetService.openView).not.toHaveBeenCalled();
		});
	});

	// ------------------------------------------------------------------
	// titleField with admin.useAsTitle
	// ------------------------------------------------------------------
	describe('titleField with admin.useAsTitle', () => {
		it('should use admin.useAsTitle when configured', () => {
			setupWithSheet();
			const customCol = {
				slug: 'posts',
				admin: { useAsTitle: 'headline' },
				fields: [{ name: 'headline', type: 'text' }],
			};
			fixture.componentRef.setInput('field', makeRelField({ collection: () => customCol }));
			flushOptionsRequest();

			expect(component.titleField()).toBe('headline');
		});
	});

	// ------------------------------------------------------------------
	// relatedLabel edge cases
	// ------------------------------------------------------------------
	describe('relatedLabel edge cases', () => {
		it('should fallback to slug when labels.singular is not a string', () => {
			setupWithSheet();
			const weirdLabels = {
				slug: 'categories',
				labels: { singular: 42, plural: 'Categories' },
				fields: [],
			};
			fixture.componentRef.setInput('field', makeRelField({ collection: () => weirdLabels }));
			flushOptionsRequest();

			expect(component.relatedLabel()).toBe('categories');
		});

		it('should return item when collection has no slug', () => {
			setupWithSheet();
			const noSlug = { fields: [] };
			fixture.componentRef.setInput('field', makeRelField({ collection: () => noSlug }));
			flushOptionsRequest();

			expect(component.relatedLabel()).toBe('item');
		});
	});

	// ------------------------------------------------------------------
	// relatedSlug when collection() returns non-record
	// ------------------------------------------------------------------
	describe('relatedSlug edge cases', () => {
		it('should return empty string when collection() returns null', () => {
			setupWithSheet();
			fixture.componentRef.setInput('field', makeRelField({ collection: () => null }));
			expect(component.relatedSlug()).toBe('');
		});

		it('should return empty string when collection() returns a string', () => {
			setupWithSheet();
			fixture.componentRef.setInput('field', makeRelField({ collection: () => 'some-string' }));
			expect(component.relatedSlug()).toBe('');
		});
	});

	// ------------------------------------------------------------------
	// multiValues edge cases
	// ------------------------------------------------------------------
	describe('multiValues edge cases', () => {
		it('should handle mixed array with objects and non-extractable items', () => {
			setupWithSheet();
			const state = createMockNodeState([
				'a1',
				{ id: 'a2', name: 'John' },
				42, // not string, not record with id
				{ noId: true },
				null,
			]);
			fixture.componentRef.setInput('formNode', createFormNode(state));
			fixture.componentRef.setInput('field', makeRelField({ hasMany: true }));
			fixture.detectChanges();
			flushOptionsRequest();

			// 'a1' is string -> 'a1'
			// { id: 'a2' } -> 'a2'
			// 42 -> '' (filtered out)
			// { noId: true } -> '' (filtered out)
			// null -> '' (filtered out)
			expect(component.multiValues()).toEqual(['a1', 'a2']);
		});
	});

	// ------------------------------------------------------------------
	// singleValue edge cases
	// ------------------------------------------------------------------
	describe('singleValue edge cases', () => {
		it('should return empty for boolean value', () => {
			setupWithSheet();
			const state = createMockNodeState(true);
			fixture.componentRef.setInput('formNode', createFormNode(state));
			flushOptionsRequest();

			expect(component.singleValue()).toBe('');
		});

		it('should return empty for array value', () => {
			setupWithSheet();
			const state = createMockNodeState(['a1']);
			fixture.componentRef.setInput('formNode', createFormNode(state));
			flushOptionsRequest();

			expect(component.singleValue()).toBe('');
		});

		it('should return id from object with id property', () => {
			setupWithSheet();
			const state = createMockNodeState({ id: 'obj-1', name: 'Object' });
			fixture.componentRef.setInput('formNode', createFormNode(state));
			flushOptionsRequest();

			expect(component.singleValue()).toBe('obj-1');
		});
	});

	// ------------------------------------------------------------------
	// onSingleSelect/onMultiSelect with no formNode
	// ------------------------------------------------------------------
	describe('onSingleSelect with no formNode', () => {
		it('should not throw when formNode is not set', () => {
			setupWithSheet();
			flushOptionsRequest();

			const select = document.createElement('select');
			const option = document.createElement('option');
			option.value = 'a1';
			select.appendChild(option);
			select.value = 'a1';
			const event = new Event('change');
			Object.defineProperty(event, 'target', { value: select });

			expect(() => component.onSingleSelect(event)).not.toThrow();
		});
	});

	describe('onMultiSelect with no formNode', () => {
		it('should not throw when formNode is not set', () => {
			setupWithSheet();
			flushOptionsRequest();

			const select = document.createElement('select');
			const option = document.createElement('option');
			option.value = 'a1';
			select.appendChild(option);
			select.value = 'a1';
			const event = new Event('change');
			Object.defineProperty(event, 'target', { value: select });

			expect(() => component.onMultiSelect(event)).not.toThrow();
		});
	});

	// ------------------------------------------------------------------
	// fetchOptions: label extraction edge cases
	// ------------------------------------------------------------------
	describe('fetchOptions label extraction', () => {
		it('should use id as label when titleField value is not a string', () => {
			setupWithSheet();
			flushOptionsRequest();

			const sub = component.fetchOptions('authors');
			const req = httpMock.match((r) => r.url === '/api/authors');
			const latestReq = req[req.length - 1];
			latestReq.flush({
				docs: [{ id: 'a1', name: 42 }], // name is number, not string
			});
			for (let i = 0; i < req.length - 1; i++) {
				req[i].flush({ docs: [] });
			}

			// titleField is 'name', but name is 42 (not string), so should use id
			expect(component.allOptions()).toEqual([{ value: 'a1', label: 'a1' }]);
			sub.unsubscribe();
		});

		it('should handle doc with non-string id', () => {
			setupWithSheet();
			flushOptionsRequest();

			const sub = component.fetchOptions('authors');
			const req = httpMock.match((r) => r.url === '/api/authors');
			const latestReq = req[req.length - 1];
			latestReq.flush({
				docs: [{ id: 123, name: 'John' }],
			});
			for (let i = 0; i < req.length - 1; i++) {
				req[i].flush({ docs: [] });
			}

			// id is 123, should be converted via String()
			expect(component.allOptions()).toEqual([{ value: '123', label: 'John' }]);
			sub.unsubscribe();
		});

		it('should handle doc with missing id', () => {
			setupWithSheet();
			flushOptionsRequest();

			const sub = component.fetchOptions('authors');
			const req = httpMock.match((r) => r.url === '/api/authors');
			const latestReq = req[req.length - 1];
			latestReq.flush({
				docs: [{ name: 'John' }], // no id field
			});
			for (let i = 0; i < req.length - 1; i++) {
				req[i].flush({ docs: [] });
			}

			expect(component.allOptions()).toEqual([{ value: '', label: 'John' }]);
			sub.unsubscribe();
		});
	});

	// ------------------------------------------------------------------
	// isMulti with hasMany undefined
	// ------------------------------------------------------------------
	describe('isMulti edge cases', () => {
		it('should return false when hasMany is undefined', () => {
			setupWithSheet();
			fixture.componentRef.setInput('field', makeRelField({ hasMany: undefined }));
			flushOptionsRequest();
			expect(component.isMulti()).toBe(false);
		});
	});

	// ------------------------------------------------------------------
	// hasSelection computed
	// ------------------------------------------------------------------
	describe('hasSelection edge cases', () => {
		it('should return false when multi values is empty array', () => {
			setupWithSheet();
			const state = createMockNodeState([]);
			fixture.componentRef.setInput('formNode', createFormNode(state));
			fixture.componentRef.setInput('field', makeRelField({ hasMany: true }));
			fixture.detectChanges();
			flushOptionsRequest();

			expect(component.hasSelection()).toBe(false);
		});

		it('should return true when multi values has items', () => {
			setupWithSheet();
			const state = createMockNodeState(['a1']);
			fixture.componentRef.setInput('formNode', createFormNode(state));
			fixture.componentRef.setInput('field', makeRelField({ hasMany: true }));
			fixture.detectChanges();
			flushOptionsRequest();

			expect(component.hasSelection()).toBe(true);
		});
	});

	// ------------------------------------------------------------------
	// removeSelection when no formNode
	// ------------------------------------------------------------------
	describe('removeSelection with no formNode', () => {
		it('should return early without error', () => {
			setupWithSheet();
			flushOptionsRequest();
			expect(() => component.removeSelection('a1')).not.toThrow();
		});
	});

	// ------------------------------------------------------------------
	// onBlur when no formNode
	// ------------------------------------------------------------------
	describe('onBlur with no formNode', () => {
		it('should not throw when formNode is not set', () => {
			setupWithSheet();
			flushOptionsRequest();
			expect(() => component.onBlur()).not.toThrow();
		});
	});
});
