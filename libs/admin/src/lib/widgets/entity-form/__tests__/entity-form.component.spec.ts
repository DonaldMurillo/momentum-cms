import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Subject } from 'rxjs';
import type { CollectionConfig, Field } from '@momentumcms/core';
import { EntityFormWidget } from '../entity-form.component';
import { UploadService, type UploadProgress } from '../../../services/upload.service';
import { VersionService } from '../../../services/version.service';
import { CollectionAccessService } from '../../../services/collection-access.service';
import { FeedbackService } from '../../feedback/feedback.service';

interface TestEntity {
	[key: string]: unknown;
	id: string;
	title: string;
	content?: string;
	email?: string;
	createdAt?: string;
	updatedAt?: string;
}

class MockUploadService {
	uploadSubject = new Subject<UploadProgress>();
	upload = vi.fn().mockReturnValue(this.uploadSubject.asObservable());
	uploadToCollection = vi.fn().mockReturnValue(this.uploadSubject.asObservable());
}

class MockVersionService {
	saveDraft = vi.fn().mockResolvedValue(undefined);
}

class MockCollectionAccess {
	canCreate = vi.fn().mockReturnValue(true);
	canUpdate = vi.fn().mockReturnValue(true);
	canDelete = vi.fn().mockReturnValue(true);
}

class MockFeedbackService {
	entityNotFound = vi.fn();
	draftSaved = vi.fn();
	operationFailed = vi.fn();
}

class MockLiveAnnouncer {
	announce = vi.fn().mockResolvedValue(undefined);
}

const textField: Field = { name: 'title', type: 'text', label: 'Title', required: true } as Field;
const emailField: Field = { name: 'email', type: 'email', label: 'Email' } as Field;
const contentField: Field = { name: 'content', type: 'textarea', label: 'Content' } as Field;

const testCollection: CollectionConfig = {
	slug: 'posts',
	labels: { singular: 'Post', plural: 'Posts' },
	fields: [textField, emailField, contentField],
	timestamps: true,
};

const uploadCollection: CollectionConfig = {
	slug: 'media',
	labels: { singular: 'Media', plural: 'Media' },
	fields: [{ name: 'alt', type: 'text', label: 'Alt Text' } as Field],
	upload: {
		mimeTypes: ['image/*'],
		maxFileSize: 1024 * 1024 * 10,
	},
};

describe('EntityFormWidget', () => {
	let fixture: ComponentFixture<EntityFormWidget<TestEntity>>;
	let component: EntityFormWidget<TestEntity>;
	let mockUpload: MockUploadService;
	let mockVersion: MockVersionService;
	let mockAccess: MockCollectionAccess;
	let mockFeedback: MockFeedbackService;
	let mockAnnouncer: MockLiveAnnouncer;
	let router: Router;

	beforeEach(async () => {
		mockUpload = new MockUploadService();
		mockVersion = new MockVersionService();
		mockAccess = new MockCollectionAccess();
		mockFeedback = new MockFeedbackService();
		mockAnnouncer = new MockLiveAnnouncer();

		await TestBed.configureTestingModule({
			imports: [EntityFormWidget],
			providers: [
				provideHttpClient(),
				provideHttpClientTesting(),
				provideRouter([]),
				{ provide: PLATFORM_ID, useValue: 'browser' },
				{ provide: UploadService, useValue: mockUpload },
				{ provide: VersionService, useValue: mockVersion },
				{ provide: CollectionAccessService, useValue: mockAccess },
				{ provide: FeedbackService, useValue: mockFeedback },
				{ provide: LiveAnnouncer, useValue: mockAnnouncer },
			],
		})
			.overrideComponent(EntityFormWidget, {
				set: { template: '<div></div>', imports: [] },
			})
			.compileComponents();

		fixture = TestBed.createComponent(EntityFormWidget<TestEntity>);
		component = fixture.componentInstance;
		router = TestBed.inject(Router);
		fixture.componentRef.setInput('collection', testCollection);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	describe('computed labels', () => {
		it('should compute collectionLabel', () => {
			expect(component.collectionLabel()).toBe('Posts');
		});

		it('should compute collectionLabelSingular', () => {
			expect(component.collectionLabelSingular()).toBe('Post');
		});

		it('should compute dashboardPath', () => {
			fixture.componentRef.setInput('basePath', '/admin/collections');
			expect(component.dashboardPath()).toBe('/admin');
		});

		it('should compute collectionListPath', () => {
			expect(component.collectionListPath()).toBe('/admin/collections/posts');
		});
	});

	describe('pageTitle', () => {
		it('should show Create for create mode', () => {
			fixture.componentRef.setInput('mode', 'create');
			expect(component.pageTitle()).toBe('Create Post');
		});

		it('should use title field value in edit mode', () => {
			fixture.componentRef.setInput('mode', 'edit');
			component.formModel.set({ title: 'My Great Post' });
			expect(component.pageTitle()).toBe('My Great Post');
		});

		it('should fallback to Edit when no title field', () => {
			fixture.componentRef.setInput('mode', 'edit');
			component.formModel.set({});
			expect(component.pageTitle()).toBe('Edit Post');
		});

		it('should use collection label for global mode', () => {
			fixture.componentRef.setInput('isGlobal', true);
			expect(component.pageTitle()).toBe('Post');
		});
	});

	describe('visibleFields', () => {
		it('should return non-hidden fields', () => {
			const fields = component.visibleFields();
			expect(fields.length).toBe(3);
		});

		it('should filter hidden fields', () => {
			const col: CollectionConfig = {
				slug: 'items',
				fields: [
					textField,
					{
						name: 'secret',
						type: 'text',
						label: 'Secret',
						admin: { hidden: true },
					} as unknown as Field,
				],
			};
			fixture.componentRef.setInput('collection', col);
			const fields = component.visibleFields();
			expect(fields.map((f) => f.name)).not.toContain('secret');
		});

		it('should respect admin.condition', () => {
			const col: CollectionConfig = {
				slug: 'items',
				fields: [
					textField,
					{
						name: 'conditional',
						type: 'text',
						label: 'Cond',
						admin: { condition: (data: Record<string, unknown>) => data['title'] === 'show' },
					} as unknown as Field,
				],
			};
			fixture.componentRef.setInput('collection', col);
			component.formModel.set({ title: 'hide' });
			expect(component.visibleFields().map((f) => f.name)).not.toContain('conditional');

			component.formModel.set({ title: 'show' });
			expect(component.visibleFields().map((f) => f.name)).toContain('conditional');
		});
	});

	describe('canEdit', () => {
		it('should delegate to CollectionAccessService', () => {
			expect(component.canEdit()).toBe(true);
			expect(mockAccess.canUpdate).toHaveBeenCalledWith('posts');
		});
	});

	describe('hasVersioning', () => {
		it('should return false when no versions config', () => {
			expect(component.hasVersioning()).toBe(false);
		});

		it('should return true when versions.drafts is true', () => {
			const col = { ...testCollection, versions: { drafts: true } };
			fixture.componentRef.setInput('collection', col);
			expect(component.hasVersioning()).toBe(true);
		});
	});

	describe('canSaveDraft', () => {
		it('should return false without versioning', () => {
			expect(component.canSaveDraft()).toBe(false);
		});

		it('should return true in edit mode with versioning and entityId', () => {
			const col = { ...testCollection, versions: { drafts: true } };
			fixture.componentRef.setInput('collection', col);
			fixture.componentRef.setInput('mode', 'edit');
			fixture.componentRef.setInput('entityId', 'e1');
			expect(component.canSaveDraft()).toBe(true);
		});

		it('should return false in create mode', () => {
			const col = { ...testCollection, versions: { drafts: true } };
			fixture.componentRef.setInput('collection', col);
			fixture.componentRef.setInput('mode', 'create');
			expect(component.canSaveDraft()).toBe(false);
		});
	});

	describe('isUploadCol', () => {
		it('should return false for non-upload collection', () => {
			expect(component.isUploadCol()).toBe(false);
		});

		it('should return true for upload collection', () => {
			fixture.componentRef.setInput('collection', uploadCollection);
			expect(component.isUploadCol()).toBe(true);
		});
	});

	describe('isDirty', () => {
		it('should return false when no entityForm', () => {
			component.entityForm.set(null);
			expect(component.isDirty()).toBe(false);
		});
	});

	describe('getFormNode', () => {
		it('should return null when no entityForm', () => {
			component.entityForm.set(null);
			expect(component.getFormNode('title')).toBeNull();
		});
	});

	describe('onFileSelected', () => {
		it('should set pendingFile and populate metadata', () => {
			fixture.componentRef.setInput('collection', uploadCollection);
			const file = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });
			component.onFileSelected(file);

			expect(component.pendingFile()).toBe(file);
			const model = component.formModel();
			expect(model['filename']).toBe('photo.jpg');
			expect(model['mimeType']).toBe('image/jpeg');
			expect(model['filesize']).toBe(file.size);
		});

		it('should reject file exceeding maxFileSize', () => {
			fixture.componentRef.setInput('collection', uploadCollection);
			const bigFile = new File([new ArrayBuffer(1024 * 1024 * 20)], 'big.jpg', {
				type: 'image/jpeg',
			});
			component.onFileSelected(bigFile);

			expect(component.pendingFile()).toBeNull();
			expect(component.uploadFileError()).toBe('File size exceeds maximum allowed size');
		});

		it('should reject file with disallowed MIME type', () => {
			fixture.componentRef.setInput('collection', uploadCollection);
			const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
			component.onFileSelected(file);

			expect(component.pendingFile()).toBeNull();
			expect(component.uploadFileError()).toBe('File type "application/pdf" is not allowed');
		});

		it('should accept file with wildcard MIME match', () => {
			fixture.componentRef.setInput('collection', uploadCollection);
			const file = new File(['content'], 'photo.png', { type: 'image/png' });
			component.onFileSelected(file);

			expect(component.pendingFile()).toBe(file);
			expect(component.uploadFileError()).toBeNull();
		});

		it('should clear previous error', () => {
			fixture.componentRef.setInput('collection', uploadCollection);
			component.uploadFileError.set('old error');
			const file = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });
			component.onFileSelected(file);
			expect(component.uploadFileError()).toBeNull();
		});
	});

	describe('onFileRemoved', () => {
		it('should clear pendingFile and metadata', () => {
			component.pendingFile.set(new File([''], 'test.jpg'));
			component.uploadFileError.set('some error');
			component.formModel.set({ filename: 'test.jpg', mimeType: 'image/jpeg', filesize: 100 });

			component.onFileRemoved();

			expect(component.pendingFile()).toBeNull();
			expect(component.uploadFileError()).toBeNull();
			expect(component.formModel()['filename']).toBe('');
			expect(component.formModel()['mimeType']).toBe('');
			expect(component.formModel()['filesize']).toBeNull();
		});
	});

	describe('onCancel', () => {
		it('should emit cancelled and navigate', () => {
			const spy = vi.fn();
			component.cancelled.subscribe(spy);
			const routerSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

			component.onCancel();

			expect(spy).toHaveBeenCalled();
			expect(routerSpy).toHaveBeenCalledWith(['/admin/collections/posts']);
		});

		it('should not navigate when suppressNavigation is true', () => {
			fixture.componentRef.setInput('suppressNavigation', true);
			const routerSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

			component.onCancel();

			expect(routerSpy).not.toHaveBeenCalled();
		});
	});

	describe('switchToEdit', () => {
		it('should emit modeChange with edit', () => {
			const spy = vi.fn();
			component.modeChange.subscribe(spy);
			component.switchToEdit();
			expect(spy).toHaveBeenCalledWith('edit');
		});
	});

	describe('onVersionRestored', () => {
		it('should not throw when no entityId', () => {
			expect(() => component.onVersionRestored()).not.toThrow();
		});
	});

	describe('onSaveDraft', () => {
		it('should call versionService.saveDraft', async () => {
			fixture.componentRef.setInput('mode', 'edit');
			fixture.componentRef.setInput('entityId', 'e1');
			component.formModel.set({ title: 'Draft Title' });

			await component.onSaveDraft();

			expect(mockVersion.saveDraft).toHaveBeenCalledWith(
				'posts',
				'e1',
				expect.objectContaining({ title: 'Draft Title' }),
			);
			expect(mockFeedback.draftSaved).toHaveBeenCalled();
		});

		it('should emit draftSaved event', async () => {
			const spy = vi.fn();
			component.draftSaved.subscribe(spy);
			fixture.componentRef.setInput('mode', 'edit');
			fixture.componentRef.setInput('entityId', 'e1');

			await component.onSaveDraft();

			expect(spy).toHaveBeenCalled();
		});

		it('should handle draft save error', async () => {
			mockVersion.saveDraft.mockRejectedValue(new Error('Network error'));
			fixture.componentRef.setInput('mode', 'edit');
			fixture.componentRef.setInput('entityId', 'e1');

			await component.onSaveDraft();

			expect(component.formError()).toBe('Network error');
			expect(mockFeedback.operationFailed).toHaveBeenCalledWith(
				'Draft save failed',
				expect.any(Error),
			);
		});

		it('should handle non-Error draft save error', async () => {
			mockVersion.saveDraft.mockRejectedValue('string error');
			fixture.componentRef.setInput('mode', 'edit');
			fixture.componentRef.setInput('entityId', 'e1');

			await component.onSaveDraft();

			expect(component.formError()).toBe('Failed to save draft');
		});

		it('should not save when no entityId', async () => {
			await component.onSaveDraft();
			expect(mockVersion.saveDraft).not.toHaveBeenCalled();
		});

		it('should not save when already saving', async () => {
			fixture.componentRef.setInput('entityId', 'e1');
			component.isSavingDraft.set(true);
			await component.onSaveDraft();
			expect(mockVersion.saveDraft).not.toHaveBeenCalled();
		});

		it('should set and clear isSavingDraft', async () => {
			let resolve!: () => void;
			mockVersion.saveDraft.mockImplementation(() => new Promise<void>((r) => (resolve = r)));
			fixture.componentRef.setInput('mode', 'edit');
			fixture.componentRef.setInput('entityId', 'e1');

			const promise = component.onSaveDraft();
			expect(component.isSavingDraft()).toBe(true);

			resolve();
			await promise;
			expect(component.isSavingDraft()).toBe(false);
		});
	});

	describe('formModel initialization', () => {
		it('should create initial form data from collection', () => {
			const model = component.formModel();
			expect(model).toHaveProperty('title');
			expect(model).toHaveProperty('email');
			expect(model).toHaveProperty('content');
		});
	});

	describe('upload collection file validation', () => {
		it('should accept file when no upload config', () => {
			const noUploadCol = { ...testCollection, upload: undefined };
			fixture.componentRef.setInput('collection', noUploadCol);

			const file = new File(['content'], 'anything.xyz', { type: 'application/octet-stream' });
			component.onFileSelected(file);
			expect(component.pendingFile()).toBe(file);
		});

		it('should accept any file when mimeTypes is empty', () => {
			const col = { ...uploadCollection, upload: { mimeTypes: [] } };
			fixture.componentRef.setInput('collection', col);

			const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
			component.onFileSelected(file);
			expect(component.pendingFile()).toBe(file);
		});
	});
});
