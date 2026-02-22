import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VersionHistoryWidget } from '../version-history.component';
import { VersionService, type DocumentVersionParsed } from '../../../services/version.service';
import { FeedbackService } from '../../feedback/feedback.service';
import { DialogService } from '@momentumcms/ui';

class MockVersionService {
	findVersions = vi.fn().mockResolvedValue({
		docs: [],
		hasNextPage: false,
		totalDocs: 0,
		totalPages: 1,
	});
	restore = vi.fn().mockResolvedValue(undefined);
	compareVersions = vi.fn().mockResolvedValue([]);
}

class MockFeedbackService {
	confirmRestore = vi.fn().mockResolvedValue(true);
	versionRestored = vi.fn();
	operationFailed = vi.fn();
}

class MockDialogService {
	open = vi.fn().mockReturnValue({ afterClosed: { subscribe: vi.fn() } });
}

describe('VersionHistoryWidget', () => {
	let fixture: ComponentFixture<VersionHistoryWidget>;
	let component: VersionHistoryWidget;
	let mockVersionService: MockVersionService;
	let mockFeedback: MockFeedbackService;
	let mockDialog: MockDialogService;

	beforeEach(async () => {
		mockVersionService = new MockVersionService();
		mockFeedback = new MockFeedbackService();
		mockDialog = new MockDialogService();

		await TestBed.configureTestingModule({
			imports: [VersionHistoryWidget],
			providers: [
				{ provide: VersionService, useValue: mockVersionService },
				{ provide: FeedbackService, useValue: mockFeedback },
				{ provide: DialogService, useValue: mockDialog },
			],
		})
			.overrideComponent(VersionHistoryWidget, {
				set: { template: '<div></div>', imports: [] },
			})
			.compileComponents();

		fixture = TestBed.createComponent(VersionHistoryWidget);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('collection', 'posts');
		fixture.componentRef.setInput('documentId', 'doc-1');
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	describe('initial state', () => {
		it('should have loading false after init resolves', () => {
			// The effect() fires during construction and findVersions resolves immediately
			expect(component.isLoading()).toBe(false);
		});

		it('should have empty versions', () => {
			expect(component.versions()).toEqual([]);
		});

		it('should have isRestoring false', () => {
			expect(component.isRestoring()).toBe(false);
		});

		it('should have null error', () => {
			expect(component.error()).toBeNull();
		});

		it('should have page 1', () => {
			expect(component.currentPage()).toBe(1);
		});

		it('should have hasNextPage false', () => {
			expect(component.hasNextPage()).toBe(false);
		});

		it('should default documentLabel to "Document"', () => {
			expect(component.documentLabel()).toBe('Document');
		});
	});

	describe('getStatusVariant', () => {
		it('should return "default" for published', () => {
			expect(component.getStatusVariant('published')).toBe('default');
		});

		it('should return "secondary" for draft', () => {
			expect(component.getStatusVariant('draft')).toBe('secondary');
		});

		it('should return "secondary" for any non-published status', () => {
			expect(component.getStatusVariant('archived' as 'draft')).toBe('secondary');
		});
	});

	describe('loadMore', () => {
		it('should call findVersions with next page', async () => {
			component.currentPage.set(1);
			component.loadMore();

			await vi.waitFor(() => {
				expect(mockVersionService.findVersions).toHaveBeenCalledWith(
					'posts',
					'doc-1',
					expect.objectContaining({ page: 2, includeAutosave: true }),
				);
			});
		});
	});

	describe('onRestore', () => {
		const version: DocumentVersionParsed = {
			id: 'v1',
			parent: 'doc-1',
			version: {},
			_status: 'draft',
			createdAt: '2024-01-01T00:00:00Z',
			updatedAt: '2024-01-01T00:00:00Z',
			autosave: false,
		};

		it('should ask for confirmation', async () => {
			await component.onRestore(version);
			expect(mockFeedback.confirmRestore).toHaveBeenCalledWith('Document');
		});

		it('should call restore when confirmed', async () => {
			await component.onRestore(version);
			expect(mockVersionService.restore).toHaveBeenCalledWith('posts', 'doc-1', {
				versionId: 'v1',
			});
		});

		it('should show success message after restore', async () => {
			await component.onRestore(version);
			expect(mockFeedback.versionRestored).toHaveBeenCalledWith('Document');
		});

		it('should set isRestoring during restore', async () => {
			let resolveRestore!: () => void;
			mockVersionService.restore.mockImplementation(
				() => new Promise<void>((resolve) => (resolveRestore = resolve)),
			);

			const promise = component.onRestore(version);
			// Wait for confirmRestore to resolve and isRestoring to be set
			await vi.waitFor(() => {
				expect(component.isRestoring()).toBe(true);
			});
			expect(component.restoringVersionId()).toBe('v1');

			resolveRestore();
			await promise;
			expect(component.isRestoring()).toBe(false);
			expect(component.restoringVersionId()).toBeNull();
		});

		it('should not call restore when not confirmed', async () => {
			mockFeedback.confirmRestore.mockResolvedValue(false);
			await component.onRestore(version);
			expect(mockVersionService.restore).not.toHaveBeenCalled();
		});

		it('should handle restore error', async () => {
			mockVersionService.restore.mockRejectedValue(new Error('Network error'));
			await component.onRestore(version);
			expect(mockFeedback.operationFailed).toHaveBeenCalledWith(
				'Restore failed',
				expect.any(Error),
			);
			expect(component.isRestoring()).toBe(false);
		});

		it('should handle non-Error restore error', async () => {
			mockVersionService.restore.mockRejectedValue('string error');
			await component.onRestore(version);
			expect(mockFeedback.operationFailed).toHaveBeenCalledWith(
				'Restore failed',
				expect.any(Error),
			);
		});
	});

	describe('onCompare', () => {
		it('should not open dialog when no versions', () => {
			component.versions.set([]);
			component.onCompare({
				id: 'v1',
				parent: 'doc-1',
				version: {},
				_status: 'draft',
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-01T00:00:00Z',
				autosave: false,
			});
			expect(mockDialog.open).not.toHaveBeenCalled();
		});

		it('should open diff dialog with correct data', () => {
			const current = {
				id: 'v2',
				parent: 'doc-1',
				version: {},
				_status: 'published' as const,
				createdAt: '2024-01-02T00:00:00Z',
				updatedAt: '2024-01-02T00:00:00Z',
				autosave: false,
			};
			const older = {
				id: 'v1',
				parent: 'doc-1',
				version: {},
				_status: 'draft' as const,
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-01T00:00:00Z',
				autosave: false,
			};
			component.versions.set([current, older]);

			component.onCompare(older);

			expect(mockDialog.open).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({
					data: expect.objectContaining({
						collection: 'posts',
						documentId: 'doc-1',
						versionId1: 'v1',
						versionId2: 'v2',
						label2: 'Current',
					}),
				}),
			);
		});
	});
});
