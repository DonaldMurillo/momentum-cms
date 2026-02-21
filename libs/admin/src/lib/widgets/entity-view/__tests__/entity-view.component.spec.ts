import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import type { CollectionConfig, Field } from '@momentumcms/core';
import { EntityViewWidget } from '../entity-view.component';
import { CollectionAccessService } from '../../../services/collection-access.service';
import { FeedbackService } from '../../feedback/feedback.service';

class MockCollectionAccessService {
	canUpdate = vi.fn().mockReturnValue(true);
	canDelete = vi.fn().mockReturnValue(true);
}

class MockFeedbackService {
	confirmDelete = vi.fn().mockResolvedValue(true);
	entityNotFound = vi.fn();
	operationFailed = vi.fn();
}

const textField: Field = { name: 'title', type: 'text' };
const emailField: Field = { name: 'email', type: 'email' };
const numberField: Field = { name: 'count', type: 'number' };
const checkboxField: Field = { name: 'active', type: 'checkbox' };
const dateField: Field = { name: 'publishedAt', type: 'date' };
const richTextField: Field = { name: 'content', type: 'richText' };
const selectField: Field = {
	name: 'status',
	type: 'select',
	options: [
		{ label: 'Draft', value: 'draft' },
		{ label: 'Published', value: 'published' },
	],
};
const groupField: Field = {
	name: 'meta',
	type: 'group',
	fields: [
		{ name: 'description', type: 'text' },
		{ name: 'keywords', type: 'text' },
	],
};
const arrayField: Field = {
	name: 'tags',
	type: 'array',
	fields: [{ name: 'label', type: 'text' }],
};
const jsonField: Field = { name: 'data', type: 'json' };
const relationshipField: Field = {
	name: 'author',
	type: 'relationship',
	collection: () => ({
		slug: 'users',
		fields: [{ name: 'name', type: 'text' }],
		labels: { singular: 'User', plural: 'Users' },
	}),
};
const _uploadField: Field = {
	name: 'image',
	type: 'upload',
	relationTo: 'media',
};
const hiddenField: Field = { name: 'secret', type: 'text', admin: { hidden: true } };

const mockCollection: CollectionConfig = {
	slug: 'posts',
	fields: [
		textField,
		emailField,
		numberField,
		checkboxField,
		dateField,
		richTextField,
		selectField,
		groupField,
		arrayField,
		jsonField,
		hiddenField,
	],
	labels: { singular: 'Post', plural: 'Posts' },
	timestamps: true,
};

describe('EntityViewWidget', () => {
	let fixture: ComponentFixture<EntityViewWidget>;
	let component: EntityViewWidget;
	let mockAccess: MockCollectionAccessService;
	let mockFeedback: MockFeedbackService;
	let router: Router;

	beforeEach(async () => {
		mockAccess = new MockCollectionAccessService();
		mockFeedback = new MockFeedbackService();

		await TestBed.configureTestingModule({
			imports: [EntityViewWidget],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				provideRouter([]),
				{ provide: PLATFORM_ID, useValue: 'browser' },
				{ provide: CollectionAccessService, useValue: mockAccess },
				{ provide: FeedbackService, useValue: mockFeedback },
			],
		})
			.overrideComponent(EntityViewWidget, {
				set: { template: '<div></div>', imports: [] },
			})
			.compileComponents();

		fixture = TestBed.createComponent(EntityViewWidget);
		component = fixture.componentInstance;
		router = TestBed.inject(Router);
		vi.spyOn(router, 'navigate').mockResolvedValue(true);
		fixture.componentRef.setInput('collection', mockCollection);
		fixture.componentRef.setInput('entityId', 'doc-1');
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	describe('collectionLabel', () => {
		it('should use plural label', () => {
			expect(component.collectionLabel()).toBe('Posts');
		});

		it('should fallback to slug when no labels', () => {
			fixture.componentRef.setInput('collection', { ...mockCollection, labels: undefined });
			expect(component.collectionLabel()).toBe('Posts');
		});
	});

	describe('collectionLabelSingular', () => {
		it('should use singular label', () => {
			expect(component.collectionLabelSingular()).toBe('Post');
		});
	});

	describe('entityTitle', () => {
		it('should return Loading when no entity', () => {
			expect(component.entityTitle()).toBe('Loading...');
		});

		it('should use title field', () => {
			component.entity.set({ id: 'doc-1', title: 'My Post' });
			expect(component.entityTitle()).toBe('My Post');
		});

		it('should use name field when no title', () => {
			component.entity.set({ id: 'doc-1', name: 'My Entity' });
			expect(component.entityTitle()).toBe('My Entity');
		});

		it('should use label field when no title/name', () => {
			component.entity.set({ id: 'doc-1', label: 'My Label' });
			expect(component.entityTitle()).toBe('My Label');
		});

		it('should use subject field', () => {
			component.entity.set({ id: 'doc-1', subject: 'My Subject' });
			expect(component.entityTitle()).toBe('My Subject');
		});

		it('should fallback to singular + id', () => {
			component.entity.set({ id: 'doc-1' });
			expect(component.entityTitle()).toBe('Post doc-1');
		});
	});

	describe('visibleFields', () => {
		it('should exclude hidden fields', () => {
			const visible = component.visibleFields();
			expect(visible.find((f) => f.name === 'secret')).toBeUndefined();
			expect(visible.find((f) => f.name === 'title')).toBeDefined();
		});

		it('should exclude fields hidden by fieldConfigs', () => {
			fixture.componentRef.setInput('fieldConfigs', [{ field: 'email', hidden: true }]);
			const visible = component.visibleFields();
			expect(visible.find((f) => f.name === 'email')).toBeUndefined();
		});
	});

	describe('hasTimestamps', () => {
		it('should return true when timestamps is true', () => {
			expect(component.hasTimestamps()).toBe(true);
		});

		it('should return false when timestamps is false', () => {
			fixture.componentRef.setInput('collection', { ...mockCollection, timestamps: false });
			expect(component.hasTimestamps()).toBe(false);
		});
	});

	describe('dashboardPath', () => {
		it('should strip /collections from basePath', () => {
			fixture.componentRef.setInput('basePath', '/admin/collections');
			expect(component.dashboardPath()).toBe('/admin');
		});

		it('should return basePath as-is when no /collections suffix', () => {
			fixture.componentRef.setInput('basePath', '/my-admin');
			expect(component.dashboardPath()).toBe('/my-admin');
		});
	});

	describe('collectionListPath', () => {
		it('should combine basePath and slug', () => {
			expect(component.collectionListPath()).toBe('/admin/collections/posts');
		});
	});

	describe('canEdit / canDelete', () => {
		it('should delegate to CollectionAccessService', () => {
			expect(component.canEdit()).toBe(true);
			expect(mockAccess.canUpdate).toHaveBeenCalledWith('posts');

			expect(component.canDelete()).toBe(true);
			expect(mockAccess.canDelete).toHaveBeenCalledWith('posts');
		});

		it('should return false when access denies', () => {
			mockAccess.canUpdate.mockReturnValue(false);
			mockAccess.canDelete.mockReturnValue(false);
			expect(component.canEdit()).toBe(false);
			expect(component.canDelete()).toBe(false);
		});
	});

	describe('hasSoftDelete', () => {
		it('should return false when no softDelete config', () => {
			expect(component.hasSoftDelete()).toBe(false);
		});

		it('should return true when softDelete is configured', () => {
			fixture.componentRef.setInput('collection', { ...mockCollection, softDelete: true });
			expect(component.hasSoftDelete()).toBe(true);
		});
	});

	describe('hasVersioning', () => {
		it('should return false when no versions config', () => {
			expect(component.hasVersioning()).toBe(false);
		});

		it('should return true when versions is configured', () => {
			fixture.componentRef.setInput('collection', {
				...mockCollection,
				versions: { drafts: true },
			});
			expect(component.hasVersioning()).toBe(true);
		});
	});

	describe('documentStatus', () => {
		it('should return draft when no entity', () => {
			expect(component.documentStatus()).toBe('draft');
		});

		it('should return published when entity has _status published', () => {
			component.entity.set({ id: 'doc-1', _status: 'published' });
			expect(component.documentStatus()).toBe('published');
		});

		it('should return draft for non-published status', () => {
			component.entity.set({ id: 'doc-1', _status: 'draft' });
			expect(component.documentStatus()).toBe('draft');
		});
	});

	describe('previewUrl', () => {
		it('should return null when no preview config', () => {
			expect(component.previewUrl()).toBeNull();
		});

		it('should return null when no entity', () => {
			fixture.componentRef.setInput('collection', {
				...mockCollection,
				admin: { preview: '/posts/{id}' },
			});
			expect(component.previewUrl()).toBeNull();
		});

		it('should interpolate string template', () => {
			fixture.componentRef.setInput('collection', {
				...mockCollection,
				admin: { preview: '/posts/{id}' },
			});
			component.entity.set({ id: 'doc-1', title: 'Test' });
			expect(component.previewUrl()).toBe('/posts/doc-1');
		});

		it('should return null for empty interpolated field', () => {
			fixture.componentRef.setInput('collection', {
				...mockCollection,
				admin: { preview: '/posts/{slug}' },
			});
			component.entity.set({ id: 'doc-1' });
			expect(component.previewUrl()).toBeNull();
		});

		it('should call function preview', () => {
			const previewFn = vi.fn().mockReturnValue('/custom/url');
			fixture.componentRef.setInput('collection', {
				...mockCollection,
				admin: { preview: previewFn },
			});
			component.entity.set({ id: 'doc-1', title: 'Test' });
			expect(component.previewUrl()).toBe('/custom/url');
		});

		it('should return null when function throws', () => {
			const previewFn = vi.fn().mockImplementation(() => {
				throw new Error('oops');
			});
			fixture.componentRef.setInput('collection', {
				...mockCollection,
				admin: { preview: previewFn },
			});
			component.entity.set({ id: 'doc-1' });
			expect(component.previewUrl()).toBeNull();
		});

		it('should handle boolean true preview', () => {
			fixture.componentRef.setInput('collection', {
				...mockCollection,
				admin: { preview: true },
			});
			component.entity.set({ id: 'doc-1' });
			expect(component.previewUrl()).toBe('/api/posts/doc-1/preview');
		});
	});

	describe('getFieldDisplayType', () => {
		it('should map text to text', () => {
			expect(component.getFieldDisplayType(textField)).toBe('text');
		});

		it('should map email to email', () => {
			expect(component.getFieldDisplayType(emailField)).toBe('email');
		});

		it('should map number to number', () => {
			expect(component.getFieldDisplayType(numberField)).toBe('number');
		});

		it('should map checkbox to boolean', () => {
			expect(component.getFieldDisplayType(checkboxField)).toBe('boolean');
		});

		it('should map date to date', () => {
			expect(component.getFieldDisplayType(dateField)).toBe('date');
		});

		it('should map richText to html', () => {
			expect(component.getFieldDisplayType(richTextField)).toBe('html');
		});

		it('should map select to badge', () => {
			expect(component.getFieldDisplayType(selectField)).toBe('badge');
		});

		it('should map group to group', () => {
			expect(component.getFieldDisplayType(groupField)).toBe('group');
		});

		it('should map array to array-table', () => {
			expect(component.getFieldDisplayType(arrayField)).toBe('array-table');
		});

		it('should map json to json', () => {
			expect(component.getFieldDisplayType(jsonField)).toBe('json');
		});

		it('should map relationship to text', () => {
			expect(component.getFieldDisplayType(relationshipField)).toBe('text');
		});

		it('should use custom config type', () => {
			fixture.componentRef.setInput('fieldConfigs', [{ field: 'title', type: 'badge' }]);
			expect(component.getFieldDisplayType(textField)).toBe('badge');
		});
	});

	describe('getFieldMeta', () => {
		it('should return sub-fields for group field', () => {
			const meta = component.getFieldMeta(groupField);
			expect(meta).toHaveLength(2);
			expect(meta[0].name).toBe('description');
		});

		it('should return sub-fields for array field', () => {
			const meta = component.getFieldMeta(arrayField);
			expect(meta).toHaveLength(1);
			expect(meta[0].name).toBe('label');
		});

		it('should return empty array for non-group/array field', () => {
			expect(component.getFieldMeta(textField)).toEqual([]);
		});

		it('should exclude hidden sub-fields', () => {
			const groupWithHidden: Field = {
				name: 'meta',
				type: 'group',
				fields: [
					{ name: 'visible', type: 'text' },
					{ name: 'hidden', type: 'text', admin: { hidden: true } },
				],
			};
			const meta = component.getFieldMeta(groupWithHidden);
			expect(meta).toHaveLength(1);
			expect(meta[0].name).toBe('visible');
		});
	});

	describe('getNumberFormat', () => {
		it('should return undefined for non-number field', () => {
			expect(component.getNumberFormat(textField)).toBeUndefined();
		});

		it('should return undefined for number without displayFormat', () => {
			expect(component.getNumberFormat(numberField)).toBeUndefined();
		});
	});

	describe('getDateFormat', () => {
		it('should return undefined for non-date field', () => {
			expect(component.getDateFormat(textField)).toBeUndefined();
		});

		it('should return undefined for date without displayFormat', () => {
			expect(component.getDateFormat(dateField)).toBeUndefined();
		});
	});

	describe('getFieldValue', () => {
		it('should return undefined when no entity', () => {
			expect(component.getFieldValue('title')).toBeUndefined();
		});

		it('should return field value from entity', () => {
			component.entity.set({ id: 'doc-1', title: 'My Post' });
			expect(component.getFieldValue('title')).toBe('My Post');
		});

		it('should resolve populated relationship object title', () => {
			component.entity.set({
				id: 'doc-1',
				author: { id: 'u1', title: 'John Doe' },
			});
			expect(component.getFieldValue('author')).toBe('John Doe');
		});

		it('should resolve populated relationship object name', () => {
			component.entity.set({
				id: 'doc-1',
				author: { id: 'u1', name: 'Jane' },
			});
			expect(component.getFieldValue('author')).toBe('Jane');
		});

		it('should fallback to id for populated relationship without title fields', () => {
			component.entity.set({
				id: 'doc-1',
				author: { id: 'u1' },
			});
			expect(component.getFieldValue('author')).toBe('u1');
		});

		it('should return resolved relationship value', () => {
			component.resolvedRelationships.set(new Map([['author', 'Resolved Author']]));
			component.entity.set({ id: 'doc-1', author: 'u1' });
			expect(component.getFieldValue('author')).toBe('Resolved Author');
		});
	});

	describe('onEditClick', () => {
		it('should emit edit event and navigate', () => {
			const entity = { id: 'doc-1', title: 'Test' };
			component.entity.set(entity);
			const emitted: unknown[] = [];
			component.edit.subscribe((e) => emitted.push(e));

			component.onEditClick();

			expect(emitted).toHaveLength(1);
			expect(router.navigate).toHaveBeenCalledWith(['/admin/collections/posts/doc-1/edit']);
		});

		it('should not navigate when suppressNavigation', () => {
			fixture.componentRef.setInput('suppressNavigation', true);
			component.entity.set({ id: 'doc-1' });
			component.onEditClick();
			expect(router.navigate).not.toHaveBeenCalled();
		});

		it('should do nothing when no entity', () => {
			const emitted: unknown[] = [];
			component.edit.subscribe((e) => emitted.push(e));
			component.onEditClick();
			expect(emitted).toHaveLength(0);
		});
	});

	describe('onDeleteClick', () => {
		it('should do nothing when no entity', async () => {
			await component.onDeleteClick();
			expect(mockFeedback.confirmDelete).not.toHaveBeenCalled();
		});

		it('should not delete when not confirmed', async () => {
			component.entity.set({ id: 'doc-1', title: 'Test' });
			mockFeedback.confirmDelete.mockResolvedValue(false);
			await component.onDeleteClick();
			expect(router.navigate).not.toHaveBeenCalled();
		});
	});

	describe('onActionClick', () => {
		it('should emit actionClick with action and entity', () => {
			const entity = { id: 'doc-1' };
			component.entity.set(entity);
			const action = { id: 'custom', label: 'Custom' };
			const emitted: unknown[] = [];
			component.actionClick.subscribe((e) => emitted.push(e));

			component.onActionClick(action);

			expect(emitted).toHaveLength(1);
			expect(emitted[0]).toEqual({ action, entity });
		});

		it('should do nothing when no entity', () => {
			const emitted: unknown[] = [];
			component.actionClick.subscribe((e) => emitted.push(e));
			component.onActionClick({ id: 'custom', label: 'Custom' });
			expect(emitted).toHaveLength(0);
		});
	});

	describe('navigateBack', () => {
		it('should navigate to collection list', () => {
			component.navigateBack();
			expect(router.navigate).toHaveBeenCalledWith(['/admin/collections/posts']);
		});

		it('should not navigate when suppressNavigation', () => {
			fixture.componentRef.setInput('suppressNavigation', true);
			component.navigateBack();
			expect(router.navigate).not.toHaveBeenCalled();
		});
	});

	describe('onStatusChanged', () => {
		it('should update entity status and emit', () => {
			component.entity.set({ id: 'doc-1', _status: 'draft' });
			const emitted: unknown[] = [];
			component.statusChanged.subscribe((s) => emitted.push(s));

			component.onStatusChanged('published');

			expect(component.entity()?.['_status']).toBe('published');
			expect(emitted).toEqual(['published']);
		});

		it('should do nothing when no entity', () => {
			const emitted: unknown[] = [];
			component.statusChanged.subscribe((s) => emitted.push(s));
			component.onStatusChanged('published');
			expect(emitted).toEqual(['published']);
		});
	});

	describe('onRestoreClick', () => {
		it('should do nothing when no entity', async () => {
			await component.onRestoreClick();
		});
	});

	describe('onForceDeleteClick', () => {
		it('should do nothing when no entity', async () => {
			await component.onForceDeleteClick();
			expect(mockFeedback.confirmDelete).not.toHaveBeenCalled();
		});

		it('should not delete when not confirmed', async () => {
			component.entity.set({ id: 'doc-1' });
			mockFeedback.confirmDelete.mockResolvedValue(false);
			await component.onForceDeleteClick();
			expect(router.navigate).not.toHaveBeenCalled();
		});
	});
});
